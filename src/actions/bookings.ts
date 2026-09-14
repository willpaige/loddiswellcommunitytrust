"use server";

import { addDays, addHours, addMonths, addWeeks, addYears, differenceInHours, format } from "date-fns";
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import { del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  bookingBlocks,
  bookingBlockSeries,
  bookingInvoices,
  bookingOccurrences,
  bookingPayments,
  bookingOfferings,
  bookingPrices,
  bookingRequirementDocuments,
  bookings,
  events,
  facilities,
  siteSettings,
  users,
} from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import {
  bookingBalance,
  customerGroups,
  recurrenceLabel,
  recurrenceOptions,
  suggestRecurringAmount,
  type CustomerGroup,
  type Recurrence,
} from "@/lib/bookings";
import { sendTemplateEmail } from "@/lib/email/send";
import { upsertCustomerRecord } from "@/actions/customer-records";
import { validateBookingDiscountCode } from "@/actions/booking-discount-codes";
import {
  bookingMinuteOfDay,
  formatBookingDate,
  parseBookingDateTime,
} from "@/lib/booking-time";
import {
  addUtcDays,
  daysOverdue,
  daysUntilDue,
  firstInvoicePeriod,
  nextPeriod,
  periodContaining,
  periodLabel,
  perSessionPrice,
  ukToday,
  type InvoicePeriod,
} from "@/lib/booking-invoices";

// How a recurring booking is paid for: a card subscription, the whole block
// upfront, or an invoice each month in advance for that month's sessions.
type RepeatPaymentMode = "subscription" | "upfront" | "monthly_invoice";

function readBillingAddress(formData: FormData) {
  const field = (key: string) => String(formData.get(key) || "").trim() || null;
  return {
    billingLine1: field("billingLine1"),
    billingLine2: field("billingLine2"),
    billingCity: field("billingCity"),
    billingPostcode: field("billingPostcode"),
  };
}

const publicFacilitySlugs = ["village-hall", "pavilion", "tennis-courts"];
const defaultRepeatDiscount = {
  threshold: 8,
  percent: 15,
};
const defaultCancellationNoticeHours = 48;

function combineDateAndTime(dateValue: string, timeValue: string) {
  if (!/^(?:[01]\d|2[0-3]):00$/.test(timeValue)) {
    throw new Error("Start times must be on the hour.");
  }
  return parseBookingDateTime(dateValue, timeValue);
}

function timeToMinutes(timeValue: string) {
  if (!/^(?:[01]\d|2[0-3]):00$/.test(timeValue)) {
    throw new Error("Times must be on the hour.");
  }
  const [hours] = timeValue.split(":").map(Number);
  return hours * 60;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function occurrenceDates(start: Date, end: Date, recurrence: Recurrence, repeatCount = 26) {
  if (recurrence === "none") return [{ startDate: start, endDate: end }];
  const addForRecurrence = {
    weekly: (date: Date, index: number) => addWeeks(date, index),
    bi_weekly: (date: Date, index: number) => addWeeks(date, index * 2),
    monthly: (date: Date, index: number) => addMonths(date, index),
    quarterly: (date: Date, index: number) => addMonths(date, index * 3),
    yearly: (date: Date, index: number) => addYears(date, index),
  }[recurrence];
  return Array.from({ length: repeatCount }, (_, index) => ({
    startDate: addForRecurrence(start, index),
    endDate: addForRecurrence(end, index),
  }));
}

// Rolling horizon for indefinite subscription bookings. Matches the 180-day
// window used by getAvailableBookingSlots so other bookings can't double-book a
// future slot this subscription will later claim.
const SUBSCRIPTION_HORIZON_DAYS = 180;

function recurrenceStep(recurrence: Recurrence, date: Date, index: number) {
  switch (recurrence) {
    case "weekly":
      return addWeeks(date, index);
    case "bi_weekly":
      return addWeeks(date, index * 2);
    case "monthly":
      return addMonths(date, index);
    case "quarterly":
      return addMonths(date, index * 3);
    case "yearly":
      return addYears(date, index);
    default:
      return date;
  }
}

// Generate occurrences for a recurring booking within (fromExclusive, until],
// stepping by index from the IMMUTABLE anchor so dates never drift and the
// result is deterministic — making top-ups idempotent.
function occurrenceDatesInWindow(
  anchorStart: Date,
  anchorEnd: Date,
  recurrence: Recurrence,
  fromExclusive: Date | null,
  until: Date
) {
  if (recurrence === "none") return [];
  const out: Array<{ startDate: Date; endDate: Date }> = [];
  for (let index = 0; index < 1000; index += 1) {
    const startDate = recurrenceStep(recurrence, anchorStart, index);
    if (startDate > until) break;
    if (fromExclusive && startDate <= fromExclusive) continue;
    out.push({ startDate, endDate: recurrenceStep(recurrence, anchorEnd, index) });
  }
  return out;
}

function defaultSubscriptionOccurrenceCount(recurrence: Recurrence) {
  switch (recurrence) {
    case "weekly":
    case "bi_weekly":
      return 26;
    case "monthly":
      return 12;
    case "quarterly":
      return 8;
    case "yearly":
      return 3;
    default:
      return 1;
  }
}

function stripeRecurringPriceData(recurrence: Recurrence) {
  switch (recurrence) {
    case "weekly":
      return { interval: "week" as const };
    case "bi_weekly":
      return { interval: "week" as const, interval_count: 2 };
    case "monthly":
      return { interval: "month" as const };
    case "quarterly":
      return { interval: "month" as const, interval_count: 3 };
    case "yearly":
      return { interval: "year" as const };
    default:
      return { interval: "month" as const };
  }
}

async function getRepeatDiscountSettings() {
  const [settings] = await db
    .select({
      threshold: siteSettings.repeatBookingDiscountThreshold,
      percent: siteSettings.repeatBookingDiscountPercent,
    })
    .from(siteSettings)
    .limit(1);

  return {
    threshold: settings?.threshold ?? defaultRepeatDiscount.threshold,
    percent: settings?.percent ?? defaultRepeatDiscount.percent,
  };
}

async function getCancellationSettings() {
  const [settings] = await db
    .select({
      noticeHours: siteSettings.bookingCancellationNoticeHours,
    })
    .from(siteSettings)
    .limit(1);

  return {
    noticeHours: settings?.noticeHours ?? defaultCancellationNoticeHours,
  };
}

async function isRangeAvailable(
  facilityId: string,
  capacity: number,
  range: { startDate: Date; endDate: Date },
  excludeBookingId?: string
) {
  const blockConflict = await db
    .select({ id: bookingBlocks.id })
    .from(bookingBlocks)
    .where(
      and(
        eq(bookingBlocks.facilityId, facilityId),
        lt(bookingBlocks.startDate, range.endDate),
        gt(bookingBlocks.endDate, range.startDate)
      )
    )
    .limit(1);
  if (blockConflict.length > 0) return false;

  const overlappingOccurrences = await db
    .select({ startDate: bookingOccurrences.startDate, endDate: bookingOccurrences.endDate })
    .from(bookingOccurrences)
    .where(
      and(
        eq(bookingOccurrences.facilityId, facilityId),
        ne(bookingOccurrences.status, "cancelled"),
        ...(excludeBookingId ? [ne(bookingOccurrences.bookingId, excludeBookingId)] : []),
        lt(bookingOccurrences.startDate, range.endDate),
        gt(bookingOccurrences.endDate, range.startDate)
      )
    );

  return hasCapacity(range, overlappingOccurrences, capacity);
}

async function ensureCustomerUser() {
  const session = await auth();
  if (!session?.user?.email) redirect("/account/login?callbackUrl=/booking");

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (existing[0]) return existing[0];

  const id = createId();
  const inserted = await db
    .insert(users)
    .values({
      id,
      email: session.user.email,
      name: session.user.name,
      role: "customer",
    })
    .returning();
  return inserted[0];
}

function bookingCallbackUrl(formData: FormData) {
  const params = new URLSearchParams();
  [
    "facilityId",
    "offeringId",
    "date",
    "time",
    "endTime",
    "customerGroup",
    "organisationName",
    "repeatPaymentMode",
    "repeatCount",
    "recurrence",
    "customerName",
    "customerPhone",
    "notes",
    "promoteOnSite",
    "promotionUrl",
    "discountCode",
    "billingLine1",
    "billingLine2",
    "billingCity",
    "billingPostcode",
  ].forEach((key) => {
    const value = formData.get(key);
    if (typeof value === "string" && value.trim()) {
      params.set(key, value);
    }
  });
  return `/booking?${params.toString()}`;
}

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "editor")) {
    throw new Error("Unauthorized");
  }
  return session;
}

function moneyText(amount: number) {
  return `£${(amount / 100).toFixed(2)}`;
}

async function bookingScheduleText(bookingId: string) {
  const rows = await db
    .select({ startDate: bookingOccurrences.startDate, endDate: bookingOccurrences.endDate })
    .from(bookingOccurrences)
    .where(and(eq(bookingOccurrences.bookingId, bookingId), ne(bookingOccurrences.status, "cancelled")))
    .orderBy(asc(bookingOccurrences.startDate));
  return rows
    .map((row) => `${formatBookingDate(row.startDate, "d MMM yyyy, HH:mm")}–${formatBookingDate(row.endDate, "HH:mm")}`)
    .join("; ");
}

// Tells the customer what moved and what it means for their money. The wording
// comes from the settlement so the email never promises a refund that Stripe
// refused, or asks for money that was taken automatically.
async function sendBookingChangedEmail(
  bookingId: string,
  context: { previousStart: Date; previousEnd: Date; settlement: BookingSettlement }
) {
  const [booking] = await db
    .select({
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      amount: bookings.amount,
      startDate: bookings.startDate,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) return;

  const settlementLine = {
    balanced: "Nothing further to pay.",
    charged:
      "We have emailed you a link for the difference, in case you have not settled it already.",
    invoiced: "We have reissued your invoice for the new total.",
    refunded:
      context.settlement.outcome === "refunded"
        ? `We have refunded ${moneyText(context.settlement.amount)} to your card. It usually clears within a few days.`
        : "",
    manual: "We will be in touch about the difference.",
  }[context.settlement.outcome];

  await sendTemplateEmail({
    key: "booking_changed",
    to: booking.customerEmail,
    variables: {
      customerName: booking.customerName,
      facilityName: booking.facilityName,
      offeringName: booking.offeringName || "Booking",
      previousSchedule: `${formatBookingDate(context.previousStart, "d MMM yyyy, HH:mm")}–${formatBookingDate(context.previousEnd, "HH:mm")}`,
      schedule:
        (await bookingScheduleText(bookingId)) ||
        formatBookingDate(booking.startDate, "d MMM yyyy, HH:mm"),
      amount: moneyText(booking.amount),
      settlementLine,
      bookingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/account/bookings`,
    },
    relatedEntityType: "booking",
    relatedEntityId: bookingId,
  });
}

async function getBookingManagerEmail() {
  const [settings] = await db
    .select({
      bookingManagerEmail: siteSettings.bookingManagerEmail,
      emailAddress: siteSettings.emailAddress,
    })
    .from(siteSettings)
    .limit(1);
  return settings?.bookingManagerEmail || settings?.emailAddress || null;
}

async function getBookingEmailData(bookingId: string) {
  const [booking] = await db
    .select({
      id: bookings.id,
      customerName: bookings.customerName,
      organisationName: bookings.organisationName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      notes: bookings.notes,
      amount: bookings.amount,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      facilityName: facilities.name,
      accessInstructions: facilities.accessInstructions,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) return null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const schedule = await bookingScheduleText(bookingId);
  return {
    ...booking,
    variables: {
      customerName: booking.customerName,
      organisationName: booking.organisationName || "",
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone || "Not provided",
      notes: booking.notes || "None",
      amount: moneyText(booking.amount),
      startDate: formatBookingDate(booking.startDate, "d MMM yyyy, HH:mm"),
      endTime: formatBookingDate(booking.endDate, "HH:mm"),
      schedule,
      facilityName: booking.facilityName,
      offeringName: booking.offeringName || "Booking",
      accessInstructions: booking.accessInstructions || "Please contact the Trust if you need access details.",
      bookingUrl: `${appUrl}/account/bookings`,
    },
  };
}

async function createBookingStripeCheckoutSession(bookingId: string) {
  const [booking] = await db
    .select({
      id: bookings.id,
      paymentType: bookings.paymentType,
      amount: bookings.amount,
      customerEmail: bookings.customerEmail,
      startDate: bookings.startDate,
      recurrence: bookings.recurrence,
      billingInterval: bookings.billingInterval,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new Error("Booking not found.");
  if (booking.paymentType === "invoice") {
    throw new Error("Monthly-invoiced bookings are paid through their invoices.");
  }
  const schedule = await bookingScheduleText(bookingId);

  // Billing cadence can differ from the session cadence; fall back to the
  // session recurrence when no explicit billing interval was set.
  const billingInterval = booking.billingInterval ?? booking.recurrence;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: booking.paymentType === "subscription" ? "subscription" : "payment",
    payment_method_types: ["card"],
    customer_email: booking.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: booking.amount,
          product_data: {
            name: `${booking.facilityName} - ${booking.offeringName || "Booking"}`,
            description:
              booking.paymentType === "subscription"
                ? `${recurrenceLabel(booking.recurrence)} session, billed ${recurrenceLabel(billingInterval).toLowerCase()}, from ${formatBookingDate(booking.startDate, "d MMM yyyy")}`
                : schedule || formatBookingDate(booking.startDate, "d MMM yyyy, HH:mm"),
          },
          ...(booking.paymentType === "subscription"
            ? { recurring: stripeRecurringPriceData(billingInterval) }
            : {}),
        },
      },
    ],
    metadata: {
      type: "booking",
      bookingId: booking.id,
    },
    subscription_data:
      booking.paymentType === "subscription"
        ? {
            metadata: {
              type: "booking",
              bookingId: booking.id,
            },
          }
        : undefined,
    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/booking/cancel?booking_id=${booking.id}`,
  });

  await db
    .update(bookings)
    .set({
      stripeCheckoutSessionId: checkoutSession.id,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id));

  return checkoutSession.url || `${appUrl}/account/bookings`;
}

async function getInvoiceSettings() {
  const [settings] = await db
    .select({
      legalName: siteSettings.legalName,
      charityNumber: siteSettings.charityNumber,
      bankAccountName: siteSettings.bankAccountName,
      bankSortCode: siteSettings.bankSortCode,
      bankAccountNumber: siteSettings.bankAccountNumber,
      invoiceFooterNote: siteSettings.invoiceFooterNote,
      invoiceDaysUntilDue: siteSettings.invoiceDaysUntilDue,
    })
    .from(siteSettings)
    .limit(1);
  return settings ?? null;
}

// Reuse or create the Stripe customer for a booking, persisting the id so
// retries and later invoices reuse it.
async function ensureBookingStripeCustomer(booking: {
  id: string;
  customerName: string;
  organisationName: string | null;
  customerEmail: string;
  customerPhone: string | null;
  billingLine1: string | null;
  billingLine2: string | null;
  billingCity: string | null;
  billingPostcode: string | null;
  stripeCustomerId: string | null;
}) {
  if (booking.stripeCustomerId) return booking.stripeCustomerId;
  const customer = await getStripe().customers.create({
    name: booking.organisationName || booking.customerName,
    email: booking.customerEmail,
    phone: booking.customerPhone || undefined,
    address: booking.billingLine1
      ? {
          line1: booking.billingLine1,
          line2: booking.billingLine2 || undefined,
          city: booking.billingCity || undefined,
          postal_code: booking.billingPostcode || undefined,
          country: "GB",
        }
      : undefined,
    metadata: { type: "booking_invoice", bookingId: booking.id },
  });
  await db
    .update(bookings)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(bookings.id, booking.id));
  return customer.id;
}

// The charity line and BACS bank-transfer instructions shown on an invoice.
function invoiceBranding(
  settings: Awaited<ReturnType<typeof getInvoiceSettings>>,
  reference: string
) {
  const footerLines: string[] = [];
  if (settings?.legalName) {
    footerLines.push(
      settings.charityNumber
        ? `${settings.legalName} · Registered charity ${settings.charityNumber}`
        : settings.legalName
    );
  }
  if (settings?.bankAccountName && settings?.bankSortCode && settings?.bankAccountNumber) {
    footerLines.push(
      `Pay by bank transfer to ${settings.bankAccountName}, sort code ${settings.bankSortCode}, account ${settings.bankAccountNumber}, reference ${reference}.`
    );
  }
  if (settings?.invoiceFooterNote) footerLines.push(settings.invoiceFooterNote);

  const customFields: { name: string; value: string }[] = [];
  if (settings?.bankSortCode) customFields.push({ name: "Sort code", value: settings.bankSortCode });
  if (settings?.bankAccountNumber)
    customFields.push({ name: "Account number", value: settings.bankAccountNumber });
  customFields.push({ name: "Reference", value: reference });

  return {
    footer: footerLines.join("\n") || undefined,
    customFields: customFields.length ? customFields.slice(0, 4) : undefined,
  };
}

export async function createBookingInvoice(bookingId: string) {
  await requireAdmin();
  const [booking] = await db
    .select({
      id: bookings.id,
      amount: bookings.amount,
      customerName: bookings.customerName,
      organisationName: bookings.organisationName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      billingLine1: bookings.billingLine1,
      billingLine2: bookings.billingLine2,
      billingCity: bookings.billingCity,
      billingPostcode: bookings.billingPostcode,
      stripeCustomerId: bookings.stripeCustomerId,
      stripeInvoiceId: bookings.stripeInvoiceId,
      invoiceStatus: bookings.invoiceStatus,
      startDate: bookings.startDate,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new Error("Booking not found.");
  const schedule = await bookingScheduleText(bookingId);

  const stripe = getStripe();

  // Idempotency: if an invoice already exists and is still live, resend rather
  // than create a duplicate.
  if (
    booking.stripeInvoiceId &&
    (booking.invoiceStatus === "open" || booking.invoiceStatus === "paid")
  ) {
    if (booking.invoiceStatus === "open") {
      await stripe.invoices.sendInvoice(booking.stripeInvoiceId);
    }
    const existing = await stripe.invoices.retrieve(booking.stripeInvoiceId);
    return { hostedUrl: existing.hosted_invoice_url ?? null };
  }

  const settings = await getInvoiceSettings();
  const reference = `BOOK-${bookingId.slice(0, 8).toUpperCase()}`;
  const customerId = await ensureBookingStripeCustomer(booking);
  const { footer, customFields } = invoiceBranding(settings, reference);

  await stripe.invoiceItems.create({
    customer: customerId,
    currency: "gbp",
    amount: booking.amount,
    description: `${booking.facilityName} - ${booking.offeringName || "Booking"} · ${schedule || formatBookingDate(booking.startDate, "d MMM yyyy, HH:mm")}`,
  });

  const invoice = await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: settings?.invoiceDaysUntilDue ?? 14,
      auto_advance: true,
      pending_invoice_items_behavior: "include",
      description: `Booking at ${booking.facilityName}`,
      footer,
      custom_fields: customFields,
      payment_settings: { payment_method_types: ["card"] },
      metadata: { type: "booking_invoice", bookingId },
    },
    { idempotencyKey: `booking-invoice-${bookingId}-${booking.amount}` }
  );
  if (!invoice.id) throw new Error("Stripe did not return an invoice id.");
  await db
    .update(bookings)
    .set({ stripeInvoiceId: invoice.id, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(invoice.id);

  await db
    .update(bookings)
    .set({
      invoiceStatus: "open",
      invoiceHostedUrl: finalized.hosted_invoice_url ?? null,
      invoicePdfUrl: finalized.invoice_pdf ?? null,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));

  await logAudit({
    action: "create",
    entity: "booking",
    entityId: bookingId,
    description: "Sent Stripe invoice",
  });
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}/edit`);
  return { hostedUrl: finalized.hosted_invoice_url ?? null };
}

export async function markBookingInvoicePaidOutOfBand(bookingId: string) {
  await requireAdmin();
  const [booking] = await db
    .select({ stripeInvoiceId: bookings.stripeInvoiceId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking?.stripeInvoiceId) throw new Error("No invoice to mark as paid.");

  // Stripe emits invoice.paid → the webhook confirms the booking (single source
  // of truth). We optimistically set invoiceStatus for immediate UI feedback.
  await getStripe().invoices.pay(booking.stripeInvoiceId, { paid_out_of_band: true });
  await db
    .update(bookings)
    .set({ invoiceStatus: "paid", paidAmount: sql`${bookings.amount}`, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));

  await logAudit({
    action: "update",
    entity: "booking",
    entityId: bookingId,
    description: "Marked invoice paid (bank transfer)",
  });
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}/edit`);
}

// ── Monthly-invoiced bookings ────────────────────────────────────────────────
//
// A regular hirer who would rather not keep a card on file holds their slot
// indefinitely and is invoiced in advance for each calendar month's sessions.
// There is no Stripe subscription: each month is a plain send_invoice invoice
// created here, so it bills the sessions the month actually holds and the
// release rule stays ours rather than Stripe's account-wide dunning.

export async function getMonthlyInvoiceSettings() {
  const [settings] = await db
    .select({
      leadDays: siteSettings.monthlyInvoiceLeadDays,
      graceDays: siteSettings.monthlyInvoiceGraceDays,
    })
    .from(siteSettings)
    .limit(1);
  return { leadDays: settings?.leadDays ?? 7, graceDays: settings?.graceDays ?? 7 };
}

export async function updateMonthlyInvoiceSettings(formData: FormData) {
  const session = await requireAdmin();
  const leadDays = Math.max(1, Math.min(28, Math.round(Number(formData.get("leadDays") || 7))));
  const graceDays = Math.max(1, Math.min(60, Math.round(Number(formData.get("graceDays") || 7))));
  const [existing] = await db.select({ id: siteSettings.id }).from(siteSettings).limit(1);
  if (existing) {
    await db
      .update(siteSettings)
      .set({
        monthlyInvoiceLeadDays: leadDays,
        monthlyInvoiceGraceDays: graceDays,
        updatedAt: new Date(),
        updatedBy: session.user?.id ?? null,
      })
      .where(eq(siteSettings.id, existing.id));
  } else {
    await db.insert(siteSettings).values({
      monthlyInvoiceLeadDays: leadDays,
      monthlyInvoiceGraceDays: graceDays,
      updatedBy: session.user?.id ?? null,
    });
  }
  await logAudit({
    action: "update",
    entity: "booking",
    description: "Updated monthly invoicing settings",
    metadata: { leadDays, graceDays },
  });
  revalidatePath("/admin/bookings/settings");
}

async function loadMonthlyInvoiceBooking(bookingId: string) {
  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      customerName: bookings.customerName,
      organisationName: bookings.organisationName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      billingLine1: bookings.billingLine1,
      billingLine2: bookings.billingLine2,
      billingCity: bookings.billingCity,
      billingPostcode: bookings.billingPostcode,
      stripeCustomerId: bookings.stripeCustomerId,
      unitAmount: bookings.unitAmount,
      pricingPercent: bookings.pricingPercent,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
      offeringEndTime: bookingOfferings.endTime,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  return booking ?? null;
}

function monthlyInvoicePeriodKey(period: InvoicePeriod) {
  return `${formatBookingDate(period.start, "yyyyMMdd")}-${formatBookingDate(period.end, "yyyyMMdd")}`;
}

function monthlyInvoiceVariables(
  booking: NonNullable<Awaited<ReturnType<typeof loadMonthlyInvoiceBooking>>>,
  invoice: { id: string; amount: number; dueDate: Date; hostedUrl: string | null; periodStart: Date; periodEnd: Date },
  sessions: { startDate: Date; endDate: Date }[],
  graceDays: number
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone || "Not provided",
    facilityName: booking.facilityName,
    offeringName: booking.offeringName || "Booking",
    period: periodLabel({ start: invoice.periodStart, end: invoice.periodEnd }),
    sessions: sessions
      .map((row) => `${formatBookingDate(row.startDate, "EEE d MMM yyyy, HH:mm")}–${formatBookingDate(row.endDate, "HH:mm")}`)
      .join("\n"),
    amount: moneyText(invoice.amount),
    dueDate: formatBookingDate(invoice.dueDate, "d MMMM yyyy"),
    releaseDate: formatBookingDate(addUtcDays(invoice.dueDate, graceDays), "d MMMM yyyy"),
    invoiceUrl: invoice.hostedUrl || `${appUrl}/account/bookings`,
    bookingUrl: `${appUrl}/account/bookings`,
    adminUrl: `${appUrl}/admin/bookings/${booking.id}/edit`,
  };
}

// Issues the invoice for one period of a monthly-invoiced booking: prices the
// sessions the period holds, allocates the money across them so a later
// cancellation refunds its share, and raises the Stripe invoice. Idempotent per
// booking, period and revision -- a rerun after a crash returns the live row.
async function issueMonthlyBookingInvoice(
  bookingId: string,
  period: InvoicePeriod,
  dueDate: Date,
  revision = 0
) {
  const booking = await loadMonthlyInvoiceBooking(bookingId);
  if (!booking) throw new Error("Booking not found.");
  if (booking.paymentType !== "invoice") throw new Error("Not a monthly-invoiced booking.");

  const [live] = await db
    .select()
    .from(bookingInvoices)
    .where(
      and(
        eq(bookingInvoices.bookingId, bookingId),
        eq(bookingInvoices.periodStart, period.start),
        ne(bookingInvoices.status, "void")
      )
    )
    .limit(1);
  if (live && live.status !== "draft") return live;

  const sessions = await db
    .select({ id: bookingOccurrences.id, startDate: bookingOccurrences.startDate, endDate: bookingOccurrences.endDate })
    .from(bookingOccurrences)
    .where(
      and(
        eq(bookingOccurrences.bookingId, bookingId),
        ne(bookingOccurrences.status, "cancelled"),
        gte(bookingOccurrences.startDate, period.start),
        lt(bookingOccurrences.startDate, period.end)
      )
    )
    .orderBy(asc(bookingOccurrences.startDate));
  if (sessions.length === 0) return null;

  const variableDuration = !booking.offeringEndTime;
  const hours = variableDuration ? differenceInHours(booking.endDate, booking.startDate) : 1;
  const perSession = perSessionPrice(booking.unitAmount, booking.pricingPercent, hours);
  const amount = perSession * sessions.length;
  if (amount <= 0) return null;

  const allocations = allocateAcrossOccurrences(amount, sessions.length);
  for (const [index, session] of sessions.entries()) {
    await db
      .update(bookingOccurrences)
      .set({ allocatedAmount: allocations[index] ?? 0 })
      .where(eq(bookingOccurrences.id, session.id));
  }

  const invoiceRowId = live?.id ?? createId();
  if (!live) {
    await db.insert(bookingInvoices).values({
      id: invoiceRowId,
      bookingId,
      periodStart: period.start,
      periodEnd: period.end,
      sessionCount: sessions.length,
      amount,
      status: "draft",
      dueDate,
      revision,
    });
  }

  const stripe = getStripe();
  const settings = await getInvoiceSettings();
  const reference = `BOOK-${bookingId.slice(0, 8).toUpperCase()}-${formatBookingDate(period.start, "MMMyy").toUpperCase()}`;
  const customerId = await ensureBookingStripeCustomer(booking);
  const { footer, customFields } = invoiceBranding(settings, reference);
  const periodKey = monthlyInvoicePeriodKey(period);
  const label = periodLabel(period);

  // The item is not covered by the invoice's idempotency key, so it gets its
  // own; a retry would otherwise leave a stray item swept into the next invoice.
  await stripe.invoiceItems.create(
    {
      customer: customerId,
      currency: "gbp",
      amount,
      description: `${booking.facilityName} - ${booking.offeringName || "Booking"} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}, ${label}`,
    },
    { idempotencyKey: `booking-monthly-item-${bookingId}-${periodKey}-r${revision}` }
  );
  const invoice = await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: "send_invoice",
      // Stripe insists the due date is ahead of it; a reissue of an overdue month
      // keeps its original due date in the ledger so the grace clock stands.
      due_date: Math.floor(Math.max(dueDate.getTime(), Date.now() + 3_600_000) / 1000),
      // Stripe would otherwise email the invoice and its own reminders on top of ours.
      auto_advance: false,
      pending_invoice_items_behavior: "include",
      description: `${booking.facilityName} sessions, ${label}`,
      footer,
      custom_fields: customFields,
      payment_settings: { payment_method_types: ["card"] },
      metadata: { type: "booking_monthly_invoice", bookingId, bookingInvoiceId: invoiceRowId },
    },
    { idempotencyKey: `booking-monthly-${bookingId}-${periodKey}-r${revision}` }
  );
  if (!invoice.id) throw new Error("Stripe did not return an invoice id.");
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

  const [row] = await db
    .update(bookingInvoices)
    .set({
      stripeInvoiceId: invoice.id,
      status: "open",
      hostedUrl: finalized.hosted_invoice_url ?? null,
      pdfUrl: finalized.invoice_pdf ?? null,
      sessionCount: sessions.length,
      amount,
      dueDate,
    })
    .where(eq(bookingInvoices.id, invoiceRowId))
    .returning();

  const { graceDays } = await getMonthlyInvoiceSettings();
  await sendTemplateEmail({
    key: "booking_invoice_issued",
    to: booking.customerEmail,
    variables: monthlyInvoiceVariables(booking, row, sessions, graceDays),
    relatedEntityType: "booking_invoice",
    relatedEntityId: `${row.id}:issued`,
  });
  await logAudit({
    action: "create",
    entity: "booking",
    entityId: bookingId,
    description: `Issued monthly invoice for ${label} (${moneyText(amount)}, ${sessions.length} sessions)`,
  });
  return row;
}

// The first invoice covers the booking's first session through the end of that
// month (or the next, when the month is nearly over). It is due a week out,
// or on the day of the first session if that comes sooner.
async function issueFirstBookingInvoice(bookingId: string) {
  const [booking] = await db
    .select({ startDate: bookings.startDate })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new Error("Booking not found.");
  const { leadDays } = await getMonthlyInvoiceSettings();
  const period = firstInvoicePeriod(booking.startDate, leadDays);
  const today = ukToday();
  const firstSessionDay = new Date(
    Date.UTC(booking.startDate.getUTCFullYear(), booking.startDate.getUTCMonth(), booking.startDate.getUTCDate())
  );
  let dueDate = addUtcDays(today, leadDays);
  if (dueDate > firstSessionDay) dueDate = firstSessionDay;
  if (dueDate <= today) dueDate = addUtcDays(today, 1);
  return issueMonthlyBookingInvoice(bookingId, period, dueDate);
}

// Applies a paid invoice: the ledger row, the sessions it covers, the booking
// itself on its first payment, and the income ledger. Trusts Stripe, not the
// caller -- the invoice is re-read and must actually be paid -- so the webhook
// and the admin's "mark paid" both funnel through here safely.
export async function applyMonthlyInvoicePaid(stripeInvoiceId: string) {
  const stripe = getStripe();
  const invoice = await stripe.invoices.retrieve(stripeInvoiceId);
  if (invoice.status !== "paid") return { applied: false as const };
  const [row] = await db
    .select()
    .from(bookingInvoices)
    .where(eq(bookingInvoices.stripeInvoiceId, stripeInvoiceId))
    .limit(1);
  if (!row) return { applied: false as const };

  // The current API reports no flag for an out-of-band payment; it is the one
  // with nothing behind it that Stripe collected.
  const firstPayment = invoice.payments?.data?.[0]?.payment;
  const paymentIntentId =
    firstPayment && typeof firstPayment.payment_intent === "string"
      ? firstPayment.payment_intent
      : firstPayment && typeof firstPayment.payment_intent === "object"
        ? firstPayment.payment_intent?.id ?? null
        : null;
  const paidOutOfBand = !paymentIntentId && !firstPayment?.charge;
  const amountPaid = invoice.amount_paid || invoice.amount_due || row.amount;

  const [earlierPaid] = await db
    .select({ id: bookingInvoices.id })
    .from(bookingInvoices)
    .where(
      and(
        eq(bookingInvoices.bookingId, row.bookingId),
        eq(bookingInvoices.status, "paid"),
        ne(bookingInvoices.id, row.id)
      )
    )
    .limit(1);

  if (row.status !== "paid") {
    await db
      .update(bookingInvoices)
      .set({ status: "paid", paidAt: new Date(), paidOutOfBand })
      .where(eq(bookingInvoices.id, row.id));
  }
  await db
    .update(bookingOccurrences)
    .set({ status: "confirmed" })
    .where(
      and(
        eq(bookingOccurrences.bookingId, row.bookingId),
        eq(bookingOccurrences.status, "pending_payment"),
        gte(bookingOccurrences.startDate, row.periodStart),
        lt(bookingOccurrences.startDate, row.periodEnd)
      )
    );
  const [booking] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, row.bookingId))
    .limit(1);
  if (booking && (booking.status === "pending_payment" || booking.status === "payment_failed")) {
    await db
      .update(bookings)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(eq(bookings.id, row.bookingId));
    // Later sessions are held on the rolling window and confirmed with the
    // booking; only the invoiced period was ever pending.
    await db
      .update(bookingOccurrences)
      .set({ status: "confirmed" })
      .where(and(eq(bookingOccurrences.bookingId, row.bookingId), eq(bookingOccurrences.status, "pending_payment")));
  }
  await recordBookingPayment({
    bookingId: row.bookingId,
    amount: amountPaid,
    paymentIntentId,
    invoiceId: stripeInvoiceId,
    paidOutOfBand,
  });
  if (!earlierPaid) {
    await createPromotionEventForBooking(row.bookingId);
    await sendBookingConfirmedEmails(row.bookingId);
  }
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${row.bookingId}/edit`);
  revalidatePath("/account/bookings");
  return { applied: true as const, bookingId: row.bookingId };
}

export async function markMonthlyInvoicePaidOutOfBand(invoiceRowId: string) {
  await requireAdmin();
  const [row] = await db
    .select()
    .from(bookingInvoices)
    .where(eq(bookingInvoices.id, invoiceRowId))
    .limit(1);
  if (!row?.stripeInvoiceId) throw new Error("No invoice to mark as paid.");
  if (row.status !== "open") throw new Error("Only an open invoice can be marked paid.");
  await getStripe().invoices.pay(row.stripeInvoiceId, { paid_out_of_band: true });
  await applyMonthlyInvoicePaid(row.stripeInvoiceId);
  await logAudit({
    action: "update",
    entity: "booking",
    entityId: row.bookingId,
    description: `Marked monthly invoice for ${periodLabel({ start: row.periodStart, end: row.periodEnd })} paid (bank transfer)`,
  });
}

export async function voidMonthlyInvoice(invoiceRowId: string) {
  await requireAdmin();
  const [row] = await db
    .select()
    .from(bookingInvoices)
    .where(eq(bookingInvoices.id, invoiceRowId))
    .limit(1);
  if (!row) throw new Error("Invoice not found.");
  if (row.status !== "open" && row.status !== "draft") throw new Error("Only an open invoice can be voided.");
  await voidMonthlyInvoiceRow(row);
  await logAudit({
    action: "update",
    entity: "booking",
    entityId: row.bookingId,
    description: `Voided monthly invoice for ${periodLabel({ start: row.periodStart, end: row.periodEnd })}`,
  });
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${row.bookingId}/edit`);
}

async function voidMonthlyInvoiceRow(row: { id: string; stripeInvoiceId: string | null; status: string }) {
  if (row.stripeInvoiceId) {
    const stripe = getStripe();
    const current = await stripe.invoices.retrieve(row.stripeInvoiceId);
    if (current.status === "draft") await stripe.invoices.del(row.stripeInvoiceId);
    else if (current.status === "open") await stripe.invoices.voidInvoice(row.stripeInvoiceId);
  }
  await db.update(bookingInvoices).set({ status: "void" }).where(eq(bookingInvoices.id, row.id));
}

async function voidOpenMonthlyInvoices(bookingId: string) {
  const rows = await db
    .select()
    .from(bookingInvoices)
    .where(and(eq(bookingInvoices.bookingId, bookingId), inArray(bookingInvoices.status, ["draft", "open"])));
  for (const row of rows) await voidMonthlyInvoiceRow(row);
  return rows.length;
}

// Sessions inside a paid period that have not happened yet are money the Trust
// holds for nothing once the booking is cancelled; flag each for a refund.
async function markPaidFutureOccurrencesRefundDue(bookingId: string) {
  const paid = await db
    .select({ periodStart: bookingInvoices.periodStart, periodEnd: bookingInvoices.periodEnd })
    .from(bookingInvoices)
    .where(and(eq(bookingInvoices.bookingId, bookingId), eq(bookingInvoices.status, "paid")));
  const now = new Date();
  for (const period of paid) {
    await db
      .update(bookingOccurrences)
      .set({ refundStatus: "due" })
      .where(
        and(
          eq(bookingOccurrences.bookingId, bookingId),
          ne(bookingOccurrences.status, "cancelled"),
          eq(bookingOccurrences.refundStatus, "none"),
          gt(bookingOccurrences.allocatedAmount, 0),
          gte(bookingOccurrences.startDate, now),
          gte(bookingOccurrences.startDate, period.periodStart),
          lt(bookingOccurrences.startDate, period.periodEnd)
        )
      );
  }
}

// A month left unpaid past the grace period: the invoice is voided so it can no
// longer be paid, its sessions and everything after them are released, and the
// booking ends so no further invoices go out.
async function releaseMonthlyInvoice(
  row: typeof bookingInvoices.$inferSelect,
  graceDays: number
) {
  const booking = await loadMonthlyInvoiceBooking(row.bookingId);
  if (!booking) return;
  const released = await db
    .select({ startDate: bookingOccurrences.startDate, endDate: bookingOccurrences.endDate })
    .from(bookingOccurrences)
    .where(
      and(
        eq(bookingOccurrences.bookingId, row.bookingId),
        ne(bookingOccurrences.status, "cancelled"),
        gte(bookingOccurrences.startDate, row.periodStart)
      )
    )
    .orderBy(asc(bookingOccurrences.startDate));

  await voidMonthlyInvoiceRow(row);
  await db
    .update(bookingInvoices)
    .set({ releasedAt: new Date() })
    .where(eq(bookingInvoices.id, row.id));
  await db
    .update(bookingOccurrences)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(bookingOccurrences.bookingId, row.bookingId),
        ne(bookingOccurrences.status, "cancelled"),
        gte(bookingOccurrences.startDate, row.periodStart)
      )
    );
  await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(bookings.id, row.bookingId));

  const variables = {
    ...monthlyInvoiceVariables(booking, row, released, graceDays),
    releasedDates: released
      .map((item) => `${formatBookingDate(item.startDate, "EEE d MMM yyyy, HH:mm")}–${formatBookingDate(item.endDate, "HH:mm")}`)
      .join("\n") || "None",
  };
  await sendTemplateEmail({
    key: "booking_invoice_released",
    to: booking.customerEmail,
    variables,
    relatedEntityType: "booking_invoice",
    relatedEntityId: `${row.id}:released`,
  });
  const managerEmail = await getBookingManagerEmail();
  if (managerEmail) {
    await sendTemplateEmail({
      key: "booking_invoice_released_manager",
      to: managerEmail,
      variables,
      relatedEntityType: "booking_invoice",
      relatedEntityId: `${row.id}:released-manager`,
    });
  }
  await logAudit({
    action: "update",
    entity: "booking",
    entityId: row.bookingId,
    description: `Released ${released.length} session(s): monthly invoice for ${periodLabel({ start: row.periodStart, end: row.periodEnd })} unpaid ${graceDays} days past due`,
  });
}

// The daily cycle for monthly-invoiced bookings: raise next month's invoices,
// chase the open ones, and release what has gone unpaid past the grace period.
export async function runMonthlyInvoiceCycle() {
  const today = ukToday();
  const { leadDays, graceDays } = await getMonthlyInvoiceSettings();
  const result = { issued: 0, reminded: 0, overdue: 0, released: 0, errors: [] as string[] };

  // Issue. Both the current month and the next are checked, so a cycle that
  // missed a day (or a booking confirmed late) still gets its invoice.
  const active = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.paymentType, "invoice"), eq(bookings.status, "confirmed")));
  const current = periodContaining(today);
  const upcoming = nextPeriod(current);
  for (const booking of active) {
    for (const period of [current, upcoming]) {
      if (today < addUtcDays(period.start, -leadDays)) continue;
      const [covered] = await db
        .select({ id: bookingInvoices.id })
        .from(bookingInvoices)
        .where(
          and(
            eq(bookingInvoices.bookingId, booking.id),
            ne(bookingInvoices.status, "void"),
            lte(bookingInvoices.periodStart, period.start),
            gte(bookingInvoices.periodEnd, period.end)
          )
        )
        .limit(1);
      if (covered) continue;
      const dueDate = period.start > today ? period.start : addUtcDays(today, 1);
      try {
        const row = await issueMonthlyBookingInvoice(booking.id, period, dueDate);
        if (row) result.issued += 1;
      } catch (error) {
        result.errors.push(`issue ${booking.id} ${periodLabel(period)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Chase and release.
  const open = await db
    .select()
    .from(bookingInvoices)
    .where(eq(bookingInvoices.status, "open"));
  const managerEmail = await getBookingManagerEmail();
  for (const row of open) {
    const booking = await loadMonthlyInvoiceBooking(row.bookingId);
    if (!booking) continue;
    const overdue = daysOverdue(row.dueDate, today);
    const untilDue = daysUntilDue(row.dueDate, today);
    try {
      if (overdue >= graceDays) {
        await releaseMonthlyInvoice(row, graceDays);
        result.released += 1;
        continue;
      }
      const sessions = await db
        .select({ startDate: bookingOccurrences.startDate, endDate: bookingOccurrences.endDate })
        .from(bookingOccurrences)
        .where(
          and(
            eq(bookingOccurrences.bookingId, row.bookingId),
            ne(bookingOccurrences.status, "cancelled"),
            gte(bookingOccurrences.startDate, row.periodStart),
            lt(bookingOccurrences.startDate, row.periodEnd)
          )
        )
        .orderBy(asc(bookingOccurrences.startDate));
      const variables = monthlyInvoiceVariables(booking, row, sessions, graceDays);
      const reminder =
        untilDue === 3 ? { when: "due in 3 days", key: "due-3" }
        : untilDue === 0 ? { when: "due today", key: "due-0" }
        : overdue === 3 ? { when: "3 days overdue", key: "overdue-3" }
        : null;
      if (reminder) {
        const sent = await sendTemplateEmail({
          key: "booking_invoice_reminder",
          to: booking.customerEmail,
          variables: { ...variables, when: reminder.when },
          relatedEntityType: "booking_invoice",
          relatedEntityId: `${row.id}:${reminder.key}`,
        });
        if (sent.sent) result.reminded += 1;
      }
      if (overdue === 1) {
        const sent = await sendTemplateEmail({
          key: "booking_invoice_overdue",
          to: booking.customerEmail,
          variables,
          relatedEntityType: "booking_invoice",
          relatedEntityId: `${row.id}:overdue-1`,
        });
        if (managerEmail) {
          await sendTemplateEmail({
            key: "booking_invoice_overdue_manager",
            to: managerEmail,
            variables,
            relatedEntityType: "booking_invoice",
            relatedEntityId: `${row.id}:overdue-manager`,
          });
        }
        if (sent.sent) result.overdue += 1;
      }
    } catch (error) {
      result.errors.push(`chase ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (result.issued || result.released) revalidatePath("/admin/bookings");
  return result;
}

// Form-posted wrappers for the edit page's invoice ledger.
export async function markMonthlyInvoicePaidAction(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId") || "");
  await markMonthlyInvoicePaidOutOfBand(invoiceId);
}

export async function voidMonthlyInvoiceAction(formData: FormData) {
  const invoiceId = String(formData.get("invoiceId") || "");
  await voidMonthlyInvoice(invoiceId);
}

export async function getAdminBookingInvoices(bookingId: string) {
  await requireAdmin();
  return db
    .select()
    .from(bookingInvoices)
    .where(eq(bookingInvoices.bookingId, bookingId))
    .orderBy(desc(bookingInvoices.periodStart), desc(bookingInvoices.revision));
}

export async function sendBookingConfirmedEmails(bookingId: string, manual = false) {
  const booking = await getBookingEmailData(bookingId);
  if (!booking) return;
  await sendTemplateEmail({
    key: manual ? "manual_booking_confirmation" : "booking_confirmation",
    to: booking.customerEmail,
    variables: booking.variables,
    relatedEntityType: "booking",
    relatedEntityId: `${bookingId}:${manual ? "manual-confirmation" : "confirmation"}`,
  });
  const managerEmail = await getBookingManagerEmail();
  if (managerEmail) {
    await sendTemplateEmail({
      key: "booking_manager_notification",
      to: managerEmail,
      variables: booking.variables,
      relatedEntityType: "booking",
      relatedEntityId: `${bookingId}:manager`,
    });
  }
}

async function sendManualBookingPaymentLinkEmail(bookingId: string, paymentUrl: string) {
  const booking = await getBookingEmailData(bookingId);
  if (!booking) return;
  await sendTemplateEmail({
    key: "manual_booking_payment_link",
    to: booking.customerEmail,
    variables: { ...booking.variables, paymentUrl },
    relatedEntityType: "booking",
    relatedEntityId: `${bookingId}:payment-link:${Date.now()}`,
    dedupe: false,
  });
}

export async function sendBookingPaymentFailedEmail(bookingId: string) {
  const booking = await getBookingEmailData(bookingId);
  if (!booking) return;
  await sendTemplateEmail({
    key: "booking_payment_failed",
    to: booking.customerEmail,
    variables: booking.variables,
    relatedEntityType: "booking",
    relatedEntityId: `${bookingId}:payment-failed`,
  });
}

export async function sendDueBookingReminderEmails() {
  const now = new Date();
  const windowStart = addHours(now, 23);
  const windowEnd = addHours(now, 25);
  const rows = await db
    .select({
      occurrenceId: bookingOccurrences.id,
      bookingId: bookings.id,
      customerEmail: bookings.customerEmail,
    })
    .from(bookingOccurrences)
    .innerJoin(bookings, eq(bookingOccurrences.bookingId, bookings.id))
    .where(
      and(
        eq(bookingOccurrences.status, "confirmed"),
        eq(bookings.status, "confirmed"),
        gte(bookingOccurrences.startDate, windowStart),
        lte(bookingOccurrences.startDate, windowEnd)
      )
    );

  let sent = 0;
  for (const row of rows) {
    const booking = await getBookingEmailData(row.bookingId);
    if (!booking) continue;
    const result = await sendTemplateEmail({
      key: "booking_reminder",
      to: row.customerEmail,
      variables: booking.variables,
      relatedEntityType: "booking_occurrence",
      relatedEntityId: row.occurrenceId,
    });
    if (result.sent) sent += 1;
  }
  return { checked: rows.length, sent };
}

async function sendBookingCancellationEmails(bookingId: string) {
  const booking = await getBookingEmailData(bookingId);
  if (!booking) return;
  await sendTemplateEmail({
    key: "booking_cancellation",
    to: booking.customerEmail,
    variables: booking.variables,
    relatedEntityType: "booking",
    relatedEntityId: `${bookingId}:cancellation`,
  });
  const managerEmail = await getBookingManagerEmail();
  if (managerEmail) {
    await sendTemplateEmail({
      key: "booking_cancellation",
      to: managerEmail,
      variables: booking.variables,
      relatedEntityType: "booking",
      relatedEntityId: `${bookingId}:manager-cancellation`,
    });
  }
}

export async function ensureDefaultBookingSetup() {
  const existing = await db.select({ id: bookingOfferings.id }).from(bookingOfferings).limit(1);
  if (existing.length > 0) return;

  const facilityRows = await db
    .select()
    .from(facilities)
    .where(inArray(facilities.slug, publicFacilitySlugs));
  const bySlug = new Map(facilityRows.map((facility) => [facility.slug, facility]));

  const groups: CustomerGroup[] = ["parent_private", "team_community", "business"];
  const seeds = [
    { slug: "tennis-courts", name: "Hourly court booking", type: "hourly", duration: 60, capacity: 2, start: null, end: null, amount: 600 },
    { slug: "village-hall", name: "Hourly hire", type: "hourly", duration: 60, capacity: 1, start: null, end: null, amount: 1500 },
    { slug: "village-hall", name: "Morning session", type: "morning", duration: 240, capacity: 1, start: "09:00", end: "13:00", amount: 4500 },
    { slug: "village-hall", name: "Afternoon session", type: "afternoon", duration: 240, capacity: 1, start: "13:00", end: "17:00", amount: 4500 },
    { slug: "village-hall", name: "Evening session", type: "evening", duration: 300, capacity: 1, start: "18:00", end: "23:00", amount: 5500 },
    { slug: "village-hall", name: "Full day", type: "full_day", duration: 840, capacity: 1, start: "09:00", end: "23:00", amount: 12000 },
    { slug: "village-hall", name: "Kids party - morning", type: "kids_party", duration: 240, capacity: 1, start: "09:00", end: "13:00", amount: 4500 },
    { slug: "village-hall", name: "Kids party - afternoon", type: "kids_party", duration: 240, capacity: 1, start: "13:00", end: "17:00", amount: 4500 },
    { slug: "pavilion", name: "Hourly hire", type: "hourly", duration: 60, capacity: 1, start: null, end: null, amount: 1000 },
    { slug: "pavilion", name: "Morning session", type: "morning", duration: 240, capacity: 1, start: "09:00", end: "13:00", amount: 3000 },
    { slug: "pavilion", name: "Afternoon session", type: "afternoon", duration: 240, capacity: 1, start: "13:00", end: "17:00", amount: 3000 },
    { slug: "pavilion", name: "Evening session", type: "evening", duration: 300, capacity: 1, start: "18:00", end: "23:00", amount: 4000 },
    { slug: "pavilion", name: "Full day", type: "full_day", duration: 840, capacity: 1, start: "09:00", end: "23:00", amount: 9000 },
  ] as const;

  for (const seed of seeds) {
    const facility = bySlug.get(seed.slug);
    if (!facility) continue;
    const [offering] = await db
      .insert(bookingOfferings)
      .values({
        facilityId: facility.id,
        name: seed.name,
        type: seed.type,
        durationMinutes: seed.duration,
        capacity: seed.capacity,
        startTime: seed.start,
        endTime: seed.end,
        sortOrder: seed.amount,
      })
      .returning();

    await db.insert(bookingPrices).values(
      groups.map((group) => ({
        offeringId: offering.id,
        customerGroup: group,
        amount:
          group === "business" ? Math.round(seed.amount * 1.4) : seed.amount,
      }))
    );
  }
}

export async function getPublicBookingData() {
  await ensureDefaultBookingSetup();
  const [rows, repeatDiscount] = await Promise.all([
    db
    .select({
      facilityId: facilities.id,
      facilityName: facilities.name,
      facilitySlug: facilities.slug,
      facilityHeroImageUrl: facilities.heroImageUrl,
      facilityBookableStartTime: facilities.bookableStartTime,
      facilityBookableEndTime: facilities.bookableEndTime,
      offeringId: bookingOfferings.id,
      offeringName: bookingOfferings.name,
      offeringType: bookingOfferings.type,
      durationMinutes: bookingOfferings.durationMinutes,
      capacity: bookingOfferings.capacity,
      startTime: bookingOfferings.startTime,
      endTime: bookingOfferings.endTime,
      customerGroup: bookingPrices.customerGroup,
      amount: bookingPrices.amount,
    })
    .from(bookingOfferings)
    .innerJoin(facilities, eq(bookingOfferings.facilityId, facilities.id))
    .innerJoin(bookingPrices, eq(bookingPrices.offeringId, bookingOfferings.id))
    .where(
      and(
        eq(bookingOfferings.active, true),
        inArray(facilities.slug, publicFacilitySlugs),
        inArray(
          bookingPrices.customerGroup,
          customerGroups.map((group) => group.value)
        )
      )
    )
    .orderBy(facilities.sortOrder, bookingOfferings.sortOrder, asc(bookingOfferings.name)),
    getRepeatDiscountSettings(),
  ]);

  return {
    customerGroups,
    offerings: rows,
    repeatDiscount,
  };
}

async function assertAvailable(
  facilityId: string,
  capacity: number,
  dates: Array<{ startDate: Date; endDate: Date }>,
  excludeBookingId?: string
) {
  for (const range of dates) {
    const available = await isRangeAvailable(facilityId, capacity, range, excludeBookingId);
    if (!available) {
      throw new Error("That time is no longer available.");
    }
  }
}

// Keeps indefinite subscription and no-payment bookings topped up with a rolling ~180-day
// window of occurrences. Run nightly by the extend-bookings cron and on each
// Stripe billing cycle. Idempotent via the (bookingId, startDate) unique index.
// Conflicts (a future slot already taken) are skipped and reported to the
// booking manager — never silently dropped, and never cancel the subscription.
export async function extendSubscriptionBookingOccurrences(bookingId?: string) {
  const horizonEnd = addDays(new Date(), SUBSCRIPTION_HORIZON_DAYS);
  const subs = await db
    .select({
      id: bookings.id,
      facilityId: bookings.facilityId,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      recurrence: bookings.recurrence,
      customerName: bookings.customerName,
      capacity: bookingOfferings.capacity,
      facilityName: facilities.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(
      and(
        or(eq(bookings.paymentType, "subscription"), eq(bookings.indefinite, true)),
        eq(bookings.status, "confirmed"),
        ne(bookings.recurrence, "none"),
        ...(bookingId ? [eq(bookings.id, bookingId)] : [])
      )
    );

  let created = 0;
  const conflicts: Array<{ booking: string; facility: string; date: string }> = [];

  for (const sub of subs) {
    const capacity = sub.capacity ?? 1;
    const [{ maxStart }] = await db
      .select({ maxStart: sql<Date | null>`max(${bookingOccurrences.startDate})` })
      .from(bookingOccurrences)
      .where(
        and(eq(bookingOccurrences.bookingId, sub.id), ne(bookingOccurrences.status, "cancelled"))
      );

    const candidates = occurrenceDatesInWindow(
      sub.startDate,
      sub.endDate,
      sub.recurrence,
      maxStart ?? null,
      horizonEnd
    );

    const toInsert: Array<{ startDate: Date; endDate: Date }> = [];
    for (const range of candidates) {
      if (await isRangeAvailable(sub.facilityId, capacity, range, sub.id)) {
        toInsert.push(range);
      } else {
        conflicts.push({
          booking: sub.customerName,
          facility: sub.facilityName,
          date: formatBookingDate(range.startDate, "d MMM yyyy, HH:mm"),
        });
      }
    }

    if (toInsert.length > 0) {
      await db
        .insert(bookingOccurrences)
        .values(
          toInsert.map((range) => ({
            bookingId: sub.id,
            facilityId: sub.facilityId,
            startDate: range.startDate,
            endDate: range.endDate,
            status: "confirmed" as const,
          }))
        )
        .onConflictDoNothing({
          target: [bookingOccurrences.bookingId, bookingOccurrences.startDate],
        });
      created += toInsert.length;
    }
  }

  if (conflicts.length > 0) {
    const managerEmail = await getBookingManagerEmail();
    if (managerEmail) {
      const lines = conflicts
        .map((c) => `- ${c.facility} — ${c.date} (${c.booking})`)
        .join("\n");
      await sendTemplateEmail({
        key: "booking_extension_conflict",
        to: managerEmail,
        variables: { count: conflicts.length, conflicts: lines },
      });
    }
  }

  return { bookingsChecked: subs.length, created, conflicts: conflicts.length };
}

export async function extendRecurringBookingBlocks() {
  const horizonEnd = addDays(new Date(), SUBSCRIPTION_HORIZON_DAYS);
  const series = await db.select().from(bookingBlockSeries).where(eq(bookingBlockSeries.indefinite, true));
  let created = 0;
  for (const item of series) {
    const [{ maxStart }] = await db
      .select({ maxStart: sql<Date | null>`max(${bookingBlocks.startDate})` })
      .from(bookingBlocks)
      .where(eq(bookingBlocks.seriesId, item.id));
    const ranges = occurrenceDatesInWindow(
      item.startDate,
      item.endDate,
      item.recurrence,
      maxStart ?? null,
      horizonEnd
    );
    if (ranges.length > 0) {
      await db.insert(bookingBlocks).values(ranges.map((range) => ({
        facilityId: item.facilityId,
        seriesId: item.id,
        title: item.title,
        startDate: range.startDate,
        endDate: range.endDate,
        notes: item.notes,
        createdBy: item.createdBy,
      })));
      created += ranges.length;
    }
  }
  return { seriesChecked: series.length, created };
}

export async function extendIndefiniteBookingSchedules() {
  const [bookingsResult, blocksResult] = await Promise.all([
    extendSubscriptionBookingOccurrences(),
    extendRecurringBookingBlocks(),
  ]);
  return { bookings: bookingsResult, blocks: blocksResult };
}

// `excludeBookingId` drops a booking's own occurrences from the conflict check,
// so editing one can move it onto the hours it already holds. The save path
// applies the same exclusion in assertAvailable.
export async function getAvailableBookingSlots(offeringId: string, excludeBookingId?: string) {
  const [offering] = await db
    .select({
      id: bookingOfferings.id,
      facilityId: bookingOfferings.facilityId,
      durationMinutes: bookingOfferings.durationMinutes,
      capacity: bookingOfferings.capacity,
      startTime: bookingOfferings.startTime,
      endTime: bookingOfferings.endTime,
      allowedDays: bookingOfferings.allowedDays,
      bookableStartTime: facilities.bookableStartTime,
      bookableEndTime: facilities.bookableEndTime,
    })
    .from(bookingOfferings)
    .innerJoin(facilities, eq(bookingOfferings.facilityId, facilities.id))
    .where(and(eq(bookingOfferings.id, offeringId), eq(bookingOfferings.active, true)))
    .limit(1);

  if (!offering) return [];

  const slots: Array<{
    date: string;
    times: string[];
    endTimesByStart: Record<string, string[]>;
  }> = [];
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(0, 0, 0, 0);
  const rangeEnd = addDays(tomorrow, 180);

  const [blocks, occurrences] = await Promise.all([
    db
      .select({
        startDate: bookingBlocks.startDate,
        endDate: bookingBlocks.endDate,
      })
      .from(bookingBlocks)
      .where(
        and(
          eq(bookingBlocks.facilityId, offering.facilityId),
          lt(bookingBlocks.startDate, rangeEnd),
          gt(bookingBlocks.endDate, tomorrow)
        )
      ),
    db
      .select({
        startDate: bookingOccurrences.startDate,
        endDate: bookingOccurrences.endDate,
      })
      .from(bookingOccurrences)
      .where(
        and(
          eq(bookingOccurrences.facilityId, offering.facilityId),
          ne(bookingOccurrences.status, "cancelled"),
          ...(excludeBookingId ? [ne(bookingOccurrences.bookingId, excludeBookingId)] : []),
          lt(bookingOccurrences.startDate, rangeEnd),
          gt(bookingOccurrences.endDate, tomorrow)
        )
      ),
  ]);

  function overlaps(
    a: { startDate: Date; endDate: Date },
    b: { startDate: Date; endDate: Date }
  ) {
    return a.startDate < b.endDate && a.endDate > b.startDate;
  }

  function rangeAvailable(range: { startDate: Date; endDate: Date }) {
    if (blocks.some((block) => overlaps(range, block))) return false;
    return hasCapacity(range, occurrences, offering.capacity);
  }

  for (let index = 0; index < 180; index += 1) {
    const day = addDays(tomorrow, index);
    if (!offering.allowedDays.includes(day.getDay())) continue;

    const startTimes = offering.startTime
      ? [offering.startTime]
      : bookingHourRange(
          offering.bookableStartTime,
          offering.bookableEndTime,
          offering.durationMinutes
        );

    const availableTimes: string[] = [];
    const endTimesByStart: Record<string, string[]> = {};
    for (const time of startTimes) {
      const startDate = combineDateAndTime(format(day, "yyyy-MM-dd"), time);
      const endTimes = offering.endTime
        ? [offering.endTime]
        : bookingEndTimeRange(time, offering.bookableEndTime, offering.durationMinutes);

      endTimesByStart[time] = endTimes.filter((endTime) => {
        const endDate = combineDateAndTime(format(day, "yyyy-MM-dd"), endTime);
        return rangeAvailable({ startDate, endDate });
      });

      if (endTimesByStart[time].length > 0) {
        availableTimes.push(time);
      }
    }

    if (availableTimes.length > 0) {
      slots.push({
        date: format(day, "yyyy-MM-dd"),
        times: availableTimes,
        endTimesByStart,
      });
    }
  }

  return slots;
}

function bookingHourRange(startTime: string, endTime: string, durationMinutes: number) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const times: string[] = [];
  for (let minutes = startMinutes; minutes + durationMinutes <= endMinutes; minutes += 60) {
    const hour = Math.floor(minutes / 60);
    times.push(`${hour.toString().padStart(2, "0")}:00`);
  }
  return times;
}

function bookingEndTimeRange(startTime: string, endTime: string, minimumDurationMinutes: number) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const times: string[] = [];
  for (let minutes = startMinutes + minimumDurationMinutes; minutes <= endMinutes; minutes += 60) {
    const hour = Math.floor(minutes / 60);
    times.push(`${hour.toString().padStart(2, "0")}:00`);
  }
  return times;
}

function hasCapacity(
  range: { startDate: Date; endDate: Date },
  existing: Array<{ startDate: Date; endDate: Date }>,
  capacity: number
) {
  const boundaries = [
    range.startDate,
    range.endDate,
    ...existing.flatMap((item) => [item.startDate, item.endDate]),
  ]
    .filter((date) => date > range.startDate && date < range.endDate)
    .sort((a, b) => a.getTime() - b.getTime());
  const checks = [range.startDate, ...boundaries];

  return checks.every((point) => {
    const overlapping = existing.filter(
      (item) => item.startDate <= point && item.endDate > point
    ).length;
    return overlapping < capacity;
  });
}

async function readBookingForm(formData: FormData) {
  const offeringId = String(formData.get("offeringId") || "");
  let customerGroup = String(formData.get("customerGroup") || "") as CustomerGroup;
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const requestedEndTime = String(formData.get("endTime") || "");
  const recurrenceValue = String(formData.get("recurrence") || "none");
  let recurrence: Recurrence =
    recurrenceOptions.some((option) => option.value === recurrenceValue)
      ? (recurrenceValue as Recurrence)
      : "none";
  const requestedMode = formData.get("repeatPaymentMode");
  let repeatPaymentMode: RepeatPaymentMode =
    recurrence === "none"
      ? "subscription"
      : requestedMode === "upfront"
        ? "upfront"
        : requestedMode === "monthly_invoice"
          ? "monthly_invoice"
          : "subscription";
  let repeatCount = recurrence !== "none"
    ? Math.max(1, Math.min(52, Math.round(Number(formData.get("repeatCount") || 8))))
    : 1;
  // Billing interval can differ from the session recurrence (e.g. a weekly
  // session billed monthly). Defaults to the session recurrence when omitted.
  const billingValue = String(formData.get("billingInterval") || "");
  const billingInterval: Exclude<Recurrence, "none"> =
    recurrenceOptions.some((option) => option.value === billingValue)
      ? (billingValue as Exclude<Recurrence, "none">)
      : recurrence !== "none"
        ? (recurrence as Exclude<Recurrence, "none">)
        : "monthly";
  // Admin-entered flat per-cycle charge in pence (subscription manual bookings).
  const recurringAmountRaw = formData.get("recurringAmount");
  const recurringAmount =
    recurringAmountRaw != null && String(recurringAmountRaw).trim() !== ""
      ? Math.max(0, Math.round(Number(recurringAmountRaw)))
      : null;

  const [offering] = await db
    .select()
    .from(bookingOfferings)
    .where(eq(bookingOfferings.id, offeringId))
    .limit(1);
  if (!offering || !offering.active) throw new Error("Invalid booking option.");

  // Kids parties are a fixed, one-off private booking. Enforce this here as
  // well as hiding the irrelevant controls in both booking forms.
  if (offering.type === "kids_party") {
    customerGroup = "parent_private";
    recurrence = "none";
    repeatPaymentMode = "upfront";
    repeatCount = 1;
  }

  const [price] = await db
    .select()
    .from(bookingPrices)
    .where(and(eq(bookingPrices.offeringId, offeringId), eq(bookingPrices.customerGroup, customerGroup)))
    .limit(1);
  if (!price) throw new Error("Invalid customer group.");

  const [facility] = await db
    .select({
      bookableStartTime: facilities.bookableStartTime,
      bookableEndTime: facilities.bookableEndTime,
    })
    .from(facilities)
    .where(eq(facilities.id, offering.facilityId))
    .limit(1);
  if (!facility) throw new Error("Invalid venue.");

  const start = offering.startTime
    ? combineDateAndTime(date, offering.startTime)
    : combineDateAndTime(date, time);
  const end = offering.endTime
    ? combineDateAndTime(date, offering.endTime)
    : requestedEndTime
      ? combineDateAndTime(date, requestedEndTime)
      : addMinutes(start, offering.durationMinutes);

  if (end <= start) {
    throw new Error("End time must be after the start time.");
  }
  if (!offering.endTime && differenceInHours(end, start) * 60 < offering.durationMinutes) {
    throw new Error("Booking duration is too short.");
  }

  const startLimit = timeToMinutes(facility.bookableStartTime);
  const endLimit = timeToMinutes(facility.bookableEndTime);
  const startMinutes = bookingMinuteOfDay(start);
  const endMinutes = bookingMinuteOfDay(end);
  const sameDay = start.toDateString() === end.toDateString();
  if (!sameDay || startMinutes < startLimit || endMinutes > endLimit) {
    throw new Error(
      `This venue can only be booked between ${facility.bookableStartTime} and ${facility.bookableEndTime}.`
    );
  }

  // Mirror getAvailableBookingSlots, which only offers slots from the start of
  // the next day onward. Comparing against an exact now+24h would reject
  // tomorrow-morning slots that the form legitimately offers.
  const earliestStart = addDays(new Date(), 1);
  earliestStart.setHours(0, 0, 0, 0);
  if (start < earliestStart) {
    throw new Error("Bookings must be made at least a day in advance.");
  }

  return {
    offering,
    price,
    start,
    end,
    recurrence,
    repeatPaymentMode,
    repeatCount,
    billingInterval,
    recurringAmount,
  };
}

// The percentage bookingAmount will actually apply. Persisted on the booking so
// a later change reprices on the deal the customer agreed to, not today's list.
function bookingPricingPercent(
  recurrence: Recurrence,
  repeatDiscount: { threshold: number; percent: number },
  repeatPaymentMode: RepeatPaymentMode,
  repeatCount: number,
  customerDiscountPercent = 0
) {
  const repeatEligible =
    recurrence !== "none" &&
    repeatPaymentMode === "upfront" &&
    repeatCount >= repeatDiscount.threshold &&
    repeatDiscount.percent > 0;
  return Math.max(customerDiscountPercent, repeatEligible ? repeatDiscount.percent : 0);
}

// Splits a booking's total across its sessions so cancelling one refunds its
// share. Any rounding remainder lands on the first session.
function allocateAcrossOccurrences(total: number, count: number) {
  if (count <= 0) return [];
  const each = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? total - each * (count - 1) : each
  );
}

function bookingAmount(
  baseAmount: number,
  start: Date,
  end: Date,
  recurrence: Recurrence,
  variableDuration: boolean,
  repeatDiscount: { threshold: number; percent: number },
  repeatPaymentMode: RepeatPaymentMode,
  repeatCount: number,
  customerDiscountPercent = 0
) {
  const hours = variableDuration ? Math.max(1, differenceInHours(end, start)) : 1;
  const amount = baseAmount * hours;
  // The repeat-booking discount only applies to upfront recurring bookings at or
  // above the threshold. We never stack discounts — take the larger of the
  // customer's personal discount and any eligible repeat discount.
  const repeatEligible =
    recurrence !== "none" &&
    repeatPaymentMode === "upfront" &&
    repeatCount >= repeatDiscount.threshold &&
    repeatDiscount.percent > 0;
  const effectivePct = Math.max(customerDiscountPercent, repeatEligible ? repeatDiscount.percent : 0);
  const applyPct = (value: number) => Math.round((value * (100 - effectivePct)) / 100);
  if (recurrence === "none") return applyPct(amount);
  if (repeatPaymentMode === "upfront") return applyPct(amount * repeatCount);
  return applyPct(amount); // subscription and monthly invoice: per session
}

type CustomSessionInput = { date: string; startTime: string; endTime: string };

function parseCustomSessions(
  raw: FormDataEntryValue | null,
  offering: typeof bookingOfferings.$inferSelect,
  facility: { bookableStartTime: string; bookableEndTime: string },
  minimum = 2
) {
  let input: CustomSessionInput[];
  try {
    input = JSON.parse(String(raw || "[]")) as CustomSessionInput[];
  } catch {
    throw new Error("Invalid custom booking schedule.");
  }
  if (!Array.isArray(input) || input.length < minimum || input.length > 52) {
    throw new Error(`Choose between ${minimum} and 52 custom sessions.`);
  }
  const earliest = addDays(new Date(), 1);
  earliest.setHours(0, 0, 0, 0);
  const seen = new Set<string>();
  const sessions = input
    .map((item) => {
      const startTime = offering.startTime || String(item.startTime || "");
      const endTime = offering.endTime || String(item.endTime || "");
      const startDate = combineDateAndTime(String(item.date || ""), startTime);
      const endDate = combineDateAndTime(String(item.date || ""), endTime);
      const key = `${startDate.toISOString()}-${endDate.toISOString()}`;
      if (seen.has(key)) throw new Error("Custom sessions cannot contain duplicates.");
      seen.add(key);
      if (endDate <= startDate || startDate < earliest) throw new Error("Invalid custom session time.");
      if (!offering.allowedDays.includes(startDate.getDay())) {
        throw new Error("One or more dates are not available for this booking type.");
      }
      if (
        timeToMinutes(startTime) < timeToMinutes(facility.bookableStartTime) ||
        timeToMinutes(endTime) > timeToMinutes(facility.bookableEndTime) ||
        differenceInHours(endDate, startDate) * 60 < offering.durationMinutes
      ) {
        throw new Error("One or more sessions are outside the venue's bookable hours.");
      }
      return { startDate, endDate };
    })
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  for (let index = 1; index < sessions.length; index += 1) {
    if (sessions[index].startDate < sessions[index - 1].endDate) {
      throw new Error("Custom sessions cannot overlap.");
    }
  }
  return sessions;
}

function allocateCustomAmounts(
  sessions: Array<{ startDate: Date; endDate: Date }>,
  baseAmount: number,
  variableDuration: boolean,
  repeatDiscount: { threshold: number; percent: number },
  customerDiscountPercent: number,
  totalOverride?: number
) {
  const raw = sessions.map(({ startDate, endDate }) =>
    baseAmount * (variableDuration ? Math.max(1, differenceInHours(endDate, startDate)) : 1)
  );
  const discount = Math.max(
    customerDiscountPercent,
    sessions.length >= repeatDiscount.threshold ? repeatDiscount.percent : 0
  );
  const calculatedTotal = Math.round((raw.reduce((sum, amount) => sum + amount, 0) * (100 - discount)) / 100);
  const total = totalOverride ?? calculatedTotal;
  const rawTotal = raw.reduce((sum, amount) => sum + amount, 0);
  const allocations = raw.map((amount) =>
    Math.floor(rawTotal > 0 ? (amount / rawTotal) * total : total / raw.length)
  );
  let remainder = total - allocations.reduce((sum, amount) => sum + amount, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % allocations.length) {
    allocations[index] += 1;
    remainder -= 1;
  }
  return { total, allocations };
}

export async function getCustomerDiscountPercent(email: string) {
  if (!email) return 0;
  const [row] = await db
    .select({ discountPercent: users.discountPercent })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return Math.max(0, Math.min(100, row?.discountPercent ?? 0));
}

function promotionDescription(facilityName: string, promotionUrl: string) {
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: `Team / community booking at ${facilityName}. ` },
          {
            type: "text",
            text: "More information",
            marks: [{ type: "link", attrs: { href: promotionUrl } }],
          },
        ],
      },
    ],
  });
}

function normalisePromotionUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Promotion link must be a valid web address.");
  }
  return url.toString();
}

export async function createPromotionEventForBooking(bookingId: string) {
  const [booking] = await db
    .select({
      id: bookings.id,
      customerGroup: bookings.customerGroup,
      customerName: bookings.customerName,
      organisationName: bookings.organisationName,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      status: bookings.status,
      scheduleType: bookings.scheduleType,
      promoteOnSite: bookings.promoteOnSite,
      promotionUrl: bookings.promotionUrl,
      promotionEventId: bookings.promotionEventId,
      createdBy: bookings.userId,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (
    !booking ||
    booking.status !== "confirmed" ||
    booking.customerGroup !== "team_community" ||
    !booking.promoteOnSite ||
    !booking.promotionUrl
  ) {
    return;
  }
  if (booking.scheduleType === "regular" && booking.promotionEventId) return;

  const occurrences = await db
    .select()
    .from(bookingOccurrences)
    .where(and(eq(bookingOccurrences.bookingId, booking.id), ne(bookingOccurrences.status, "cancelled")));
  const occurrencesToPromote = booking.scheduleType === "custom" ? occurrences : occurrences.slice(0, 1);
  for (const occurrence of occurrencesToPromote) {
    if (occurrence.promotionEventId) continue;
    const eventId = createId();
    await db.insert(events).values({
      id: eventId,
      title: booking.organisationName || booking.customerName || booking.offeringName || "Team / community booking",
      description: promotionDescription(booking.facilityName, booking.promotionUrl),
      location: booking.facilityName,
      startDate: occurrence.startDate,
      endDate: occurrence.endDate,
      allDay: false,
      externalUrl: booking.promotionUrl,
      published: true,
      createdBy: booking.createdBy,
    });
    await db
      .update(bookingOccurrences)
      .set({ promotionEventId: eventId })
      .where(eq(bookingOccurrences.id, occurrence.id));
    if (!booking.promotionEventId) {
      await db.update(bookings).set({ promotionEventId: eventId }).where(eq(bookings.id, booking.id));
      booking.promotionEventId = eventId;
    }
  }
  revalidatePath("/events");
}

export async function createBookingCheckout(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/account/login?callbackUrl=${encodeURIComponent(bookingCallbackUrl(formData))}`);
  }
  const customer = await ensureCustomerUser();
  const { offering, price, start, end, recurrence, repeatPaymentMode, repeatCount } =
    await readBookingForm(formData);
  const repeatDiscount = await getRepeatDiscountSettings();
  const isMonthlyInvoice = recurrence !== "none" && repeatPaymentMode === "monthly_invoice";
  // A monthly-invoiced booking holds its slot indefinitely on the same rolling
  // window a subscription uses; the nightly cron keeps it topped up.
  const dates = isMonthlyInvoice
    ? occurrenceDatesInWindow(start, end, recurrence, null, addDays(new Date(), SUBSCRIPTION_HORIZON_DAYS))
    : occurrenceDates(
        start,
        end,
        recurrence,
        repeatPaymentMode === "upfront" ? repeatCount : defaultSubscriptionOccurrenceCount(recurrence)
      );
  await assertAvailable(offering.facilityId, offering.capacity, dates);

  const facility = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, offering.facilityId))
    .limit(1);
  const customerName = String(formData.get("customerName") || customer.name || "").trim();
  const organisationName = String(formData.get("organisationName") || "").trim() || null;
  const customerPhone = String(formData.get("customerPhone") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const customerEmail = customer.email.toLowerCase();
  const submittedDiscountCode = String(formData.get("discountCode") || "").trim();
  const codeResult = submittedDiscountCode
    ? await validateBookingDiscountCode(submittedDiscountCode, customerEmail)
    : null;
  if (codeResult && !codeResult.valid) throw new Error(codeResult.message);
  if (!customerName) throw new Error("Name is required.");
  if ((price.customerGroup === "team_community" || price.customerGroup === "business") && !organisationName) {
    throw new Error("Business, club, or event name is required.");
  }
  const billing = readBillingAddress(formData);
  if (isMonthlyInvoice && (!billing.billingLine1 || !billing.billingCity || !billing.billingPostcode)) {
    throw new Error("A billing address is required for monthly invoicing.");
  }
  await upsertCustomerRecord({
    email: customerEmail,
    name: customerName,
    phone: customerPhone,
  });
  const promoteOnSite =
    price.customerGroup === "team_community" && formData.get("promoteOnSite") === "on";
  const promotionUrl = promoteOnSite
    ? normalisePromotionUrl(String(formData.get("promotionUrl") || ""))
    : null;
  if (promoteOnSite && !promotionUrl) {
    throw new Error("Add a public link for the promoted event.");
  }

  const bookingId = createId();
  const effectiveDiscountPercent = Math.max(
    customer.discountPercent,
    codeResult?.discountPercent ?? 0
  );
  const amount = bookingAmount(
    price.amount,
    start,
    end,
    recurrence,
    !offering.endTime,
    repeatDiscount,
    repeatPaymentMode,
    repeatCount,
    effectiveDiscountPercent
  );
  const undiscountedAmount = bookingAmount(
    price.amount, start, end, recurrence, !offering.endTime,
    { ...repeatDiscount, percent: 0 }, repeatPaymentMode, repeatCount, 0
  );
  const repeatEligible = recurrence !== "none" && repeatPaymentMode === "upfront" &&
    repeatCount >= repeatDiscount.threshold;
  const appliedDiscountPercent = Math.max(
    effectiveDiscountPercent,
    repeatEligible ? repeatDiscount.percent : 0
  );
  // A 100% discount makes this free — Stripe rejects a £0 charge, so confirm
  // the booking directly without going through checkout.
  const isFree = amount <= 0;
  await db.insert(bookings).values({
    id: bookingId,
    userId: customer.id,
    facilityId: offering.facilityId,
    offeringId: offering.id,
    customerGroup: price.customerGroup,
    customerName,
    organisationName,
    customerEmail,
    customerPhone,
    notes,
    status: isFree ? "confirmed" : "pending_payment",
    paymentType: isFree
      ? "manual"
      : isMonthlyInvoice
        ? "invoice"
        : recurrence !== "none" && repeatPaymentMode === "subscription"
          ? "subscription"
          : "one_off",
    amount,
    discountCodeId: codeResult?.id ?? null,
    discountCode: codeResult?.code ?? null,
    discountPercent: appliedDiscountPercent,
    discountAmount: Math.max(0, undiscountedAmount - amount),
    unitAmount: price.amount,
    pricingPercent: bookingPricingPercent(
      recurrence,
      repeatDiscount,
      repeatPaymentMode,
      repeatCount,
      effectiveDiscountPercent
    ),
    startDate: start,
    endDate: end,
    recurrence,
    indefinite: isMonthlyInvoice && !isFree,
    billingInterval: isMonthlyInvoice && !isFree ? "monthly" : null,
    repeatCount: recurrence !== "none" ? dates.length : 1,
    promoteOnSite,
    promotionUrl,
    requirementSetId: offering.requirementSetId ?? null,
    ...(isMonthlyInvoice ? billing : {}),
  });
  // A monthly-invoiced booking's sessions are priced invoice by invoice, so
  // nothing is allocated to them here.
  const allocations = isMonthlyInvoice && !isFree ? [] : allocateAcrossOccurrences(amount, dates.length);
  await db.insert(bookingOccurrences).values(
    dates.map((date, index) => ({
      bookingId,
      facilityId: offering.facilityId,
      startDate: date.startDate,
      endDate: date.endDate,
      status: isFree ? ("confirmed" as const) : ("pending_payment" as const),
      allocatedAmount: allocations[index] ?? 0,
    }))
  );

  if (isFree) {
    await sendBookingConfirmedEmails(bookingId);
    await createPromotionEventForBooking(bookingId);
    redirect("/booking/success");
  }

  if (isMonthlyInvoice) {
    await issueFirstBookingInvoice(bookingId);
    redirect(`/booking/success?booking_id=${bookingId}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: recurrence !== "none" && repeatPaymentMode === "subscription" ? "subscription" : "payment",
    payment_method_types: ["card"],
    customer_email: customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: amount,
          product_data: {
            name: `${facility[0]?.name || "Facility"} - ${offering.name}`,
            description:
              recurrence !== "none" && repeatPaymentMode === "subscription"
                ? `${recurrenceLabel(recurrence)} booking from ${formatBookingDate(start, "d MMM yyyy")}`
                : recurrence !== "none"
                  ? `${repeatCount} ${recurrenceLabel(recurrence).toLowerCase()} bookings from ${formatBookingDate(start, "d MMM yyyy")}`
                : formatBookingDate(start, "d MMM yyyy, HH:mm"),
          },
          ...(recurrence !== "none" && repeatPaymentMode === "subscription"
            ? { recurring: stripeRecurringPriceData(recurrence) }
            : {}),
        },
      },
    ],
    metadata: {
      type: "booking",
      bookingId,
    },
    subscription_data:
      recurrence !== "none" && repeatPaymentMode === "subscription"
        ? {
            metadata: {
              type: "booking",
              bookingId,
            },
          }
        : undefined,
    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/booking/cancel?booking_id=${bookingId}`,
  });

  await db
    .update(bookings)
    .set({
      stripeCheckoutSessionId: checkoutSession.id,
      stripeCustomerId:
        typeof checkoutSession.customer === "string"
          ? checkoutSession.customer
          : null,
    })
    .where(eq(bookings.id, bookingId));

  redirect(checkoutSession.url || "/booking");
}

export async function confirmStripeBooking(sessionId: string) {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.stripeCheckoutSessionId, sessionId))
    .limit(1);
  if (!booking) {
    // A change or top-up session belongs to no booking by checkout id. The
    // webhook is what applies it; this is the backstop for when the customer
    // lands back before it arrives. Both paths are idempotent.
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (
      session.payment_status === "paid" &&
      session.metadata?.type === "booking_change" &&
      session.metadata.bookingId
    ) {
      await applyPaidBookingChange(
        session.metadata.bookingId,
        {
          start: new Date(session.metadata.startIso),
          end: new Date(session.metadata.endIso),
          amount: Number(session.metadata.newAmount),
        },
        session.amount_total ?? 0
      );
    }
    return null;
  }

  const checkoutSession = await getStripe().checkout.sessions.retrieve(sessionId);
  if (
    checkoutSession.metadata?.type !== "booking" ||
    checkoutSession.metadata.bookingId !== booking.id
  ) {
    return booking;
  }

  if (booking.status !== "confirmed") {
    await db
      .update(bookings)
      .set({
        status: "confirmed",
        paidAmount: checkoutSession.amount_total ?? booking.amount,
        stripePaymentIntentId:
          typeof checkoutSession.payment_intent === "string"
            ? checkoutSession.payment_intent
            : checkoutSession.payment_intent?.id ?? null,
        stripeSubscriptionId:
          typeof checkoutSession.subscription === "string"
            ? checkoutSession.subscription
            : checkoutSession.subscription?.id ?? null,
        stripeCustomerId:
          typeof checkoutSession.customer === "string"
            ? checkoutSession.customer
            : checkoutSession.customer?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));
    await db
      .update(bookingOccurrences)
      .set({ status: "confirmed" })
      .where(eq(bookingOccurrences.bookingId, booking.id));
    await recordBookingPayment({
      bookingId: booking.id,
      paymentIntentId:
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id,
      amount: checkoutSession.amount_total ?? booking.amount,
    });
    await createPromotionEventForBooking(booking.id);
    await sendBookingConfirmedEmails(booking.id);
  } else if (!booking.stripePaymentIntentId || !booking.stripeSubscriptionId || !booking.stripeCustomerId) {
    await db
      .update(bookings)
      .set({
        stripePaymentIntentId:
          typeof checkoutSession.payment_intent === "string"
            ? checkoutSession.payment_intent
            : checkoutSession.payment_intent?.id ?? null,
        stripeSubscriptionId:
          typeof checkoutSession.subscription === "string"
            ? checkoutSession.subscription
            : checkoutSession.subscription?.id ?? null,
        stripeCustomerId:
          typeof checkoutSession.customer === "string"
            ? checkoutSession.customer
            : checkoutSession.customer?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));
  }

  return booking;
}

export async function getCustomerBookings() {
  const session = await auth();
  if (!session?.user?.email) redirect("/account/login?callbackUrl=/account/bookings");

  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      amount: bookings.amount,
      paidAmount: bookings.paidAmount,
      offeringId: bookings.offeringId,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      scheduleType: bookings.scheduleType,
      organisationName: bookings.organisationName,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      recurrence: bookings.recurrence,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.customerEmail, session.user.email.toLowerCase()))
    .orderBy(desc(bookings.startDate));
  const invoices = await latestBookingInvoices(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, invoice: invoices.get(row.id) ?? null }));
}

// The invoice a monthly-invoiced booking is currently on: an open one if there
// is one, otherwise the most recent. Keyed by booking id.
async function latestBookingInvoices(bookingIds: string[]) {
  const result = new Map<
    string,
    { id: string; status: string; amount: number; dueDate: Date; periodStart: Date; periodEnd: Date; hostedUrl: string | null }
  >();
  if (bookingIds.length === 0) return result;
  const rows = await db
    .select({
      id: bookingInvoices.id,
      bookingId: bookingInvoices.bookingId,
      status: bookingInvoices.status,
      amount: bookingInvoices.amount,
      dueDate: bookingInvoices.dueDate,
      periodStart: bookingInvoices.periodStart,
      periodEnd: bookingInvoices.periodEnd,
      hostedUrl: bookingInvoices.hostedUrl,
    })
    .from(bookingInvoices)
    .where(and(inArray(bookingInvoices.bookingId, bookingIds), ne(bookingInvoices.status, "void")))
    .orderBy(desc(bookingInvoices.periodStart));
  for (const row of rows) {
    const current = result.get(row.bookingId);
    if (!current || (row.status === "open" && current.status !== "open")) result.set(row.bookingId, row);
  }
  return result;
}

export async function getCustomerBookingCancellationSettings() {
  const session = await auth();
  if (!session?.user?.email) redirect("/account/login?callbackUrl=/account/bookings");

  return getCancellationSettings();
}

export async function retryCustomerBookingPayment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const id = String(formData.get("bookingId") || "");
  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      invoiceStatus: bookings.invoiceStatus,
      stripeCheckoutSessionId: bookings.stripeCheckoutSessionId,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      amount: bookings.amount,
      customerEmail: bookings.customerEmail,
      startDate: bookings.startDate,
      recurrence: bookings.recurrence,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking || booking.customerEmail !== session.user.email.toLowerCase()) {
    throw new Error("Booking not found.");
  }
  if (booking.paymentType === "invoice") {
    const invoice = (await latestBookingInvoices([booking.id])).get(booking.id);
    if (!invoice || invoice.status !== "open" || !invoice.hostedUrl) {
      throw new Error("No invoice is outstanding on this booking.");
    }
    redirect(invoice.hostedUrl);
  }
  if (booking.status !== "pending_payment") {
    throw new Error("Only pending bookings can be paid online.");
  }

  const paymentUrl = await createBookingStripeCheckoutSession(booking.id);
  redirect(paymentUrl || "/account/bookings");
}

export async function cancelCustomerBooking(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const id = String(formData.get("bookingId") || "");
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking || booking.customerEmail !== session.user.email.toLowerCase()) {
    throw new Error("Booking not found.");
  }
  if (!["pending_payment", "payment_failed", "confirmed"].includes(booking.status)) {
    throw new Error("This booking cannot be cancelled online.");
  }

  if (booking.status === "confirmed") {
    const cancellationSettings = await getCancellationSettings();
    // The notice period runs from the next session, not the series anchor --
    // for a running regular booking the anchor is long past.
    const [next] = await db
      .select({ startDate: bookingOccurrences.startDate })
      .from(bookingOccurrences)
      .where(
        and(
          eq(bookingOccurrences.bookingId, id),
          ne(bookingOccurrences.status, "cancelled"),
          gte(bookingOccurrences.startDate, new Date())
        )
      )
      .orderBy(asc(bookingOccurrences.startDate))
      .limit(1);
    const nextStart = next?.startDate ?? booking.startDate;
    if (differenceInHours(nextStart, new Date()) < cancellationSettings.noticeHours) {
      throw new Error(
        `Bookings can only be cancelled online at least ${cancellationSettings.noticeHours} hours before the start time.`
      );
    }

    if (booking.paymentType === "one_off" && booking.stripePaymentIntentId) {
      // Everything taken, not just the first payment: an extended booking has a
      // top-up behind it, and refunding only the original keeps the difference.
      await refundBookingPayments(id, booking.paidAmount, "booking cancelled");
    }
    if (booking.paymentType === "subscription" && booking.stripeSubscriptionId) {
      await getStripe().subscriptions.cancel(booking.stripeSubscriptionId);
    }
  }

  if (booking.paymentType === "invoice") {
    // No further invoices; sessions already paid for but not yet held are
    // flagged for the Trust to refund by hand.
    await voidOpenMonthlyInvoices(id);
    await markPaidFutureOccurrencesRefundDue(id);
  }

  await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(bookings.id, id));
  await db
    .update(bookingOccurrences)
    .set({ status: "cancelled" })
    .where(eq(bookingOccurrences.bookingId, id));

  await sendBookingCancellationEmails(id);

  revalidatePath("/account/bookings");
}

type ChangeableBooking = Awaited<ReturnType<typeof loadChangeableBooking>>;

// A booking a customer is allowed to move themselves. Everything else -- someone
// else's booking, a subscription, a series, a booking inside the notice window --
// is refused here rather than in the UI, so the rules hold whatever is posted.
async function loadChangeableBooking(bookingId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      recurrence: bookings.recurrence,
      scheduleType: bookings.scheduleType,
      customerEmail: bookings.customerEmail,
      customerGroup: bookings.customerGroup,
      customerName: bookings.customerName,
      amount: bookings.amount,
      paidAmount: bookings.paidAmount,
      unitAmount: bookings.unitAmount,
      pricingPercent: bookings.pricingPercent,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      offeringId: bookings.offeringId,
      facilityId: bookings.facilityId,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
      offeringStartTime: bookingOfferings.startTime,
      offeringEndTime: bookingOfferings.endTime,
      offeringCapacity: bookingOfferings.capacity,
      offeringDurationMinutes: bookingOfferings.durationMinutes,
      offeringAllowedDays: bookingOfferings.allowedDays,
      bookableStartTime: facilities.bookableStartTime,
      bookableEndTime: facilities.bookableEndTime,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking || booking.customerEmail !== session.user.email.toLowerCase()) {
    throw new Error("Booking not found.");
  }
  if (!booking.offeringId) throw new Error("This booking cannot be changed online.");
  if (booking.status !== "confirmed" && booking.status !== "pending_payment") {
    throw new Error("This booking cannot be changed online.");
  }
  if (booking.paymentType === "subscription") {
    throw new Error("Please contact the Trust to change a subscription booking.");
  }
  if (booking.recurrence !== "none" || booking.scheduleType !== "regular") {
    throw new Error("Please contact the Trust to change a repeating booking.");
  }

  const cancellationSettings = await getCancellationSettings();
  if (differenceInHours(booking.startDate, new Date()) < cancellationSettings.noticeHours) {
    throw new Error(
      `Bookings can only be changed online at least ${cancellationSettings.noticeHours} hours before the start time.`
    );
  }
  return booking;
}

// Reprices a move on the rate the booking was sold at. Bookings taken before
// rates were recorded fall back to the current list.
async function quoteBookingChange(booking: ChangeableBooking, start: Date, end: Date) {
  const [price] = await db
    .select({ amount: bookingPrices.amount })
    .from(bookingPrices)
    .where(
      and(
        eq(bookingPrices.offeringId, booking.offeringId!),
        eq(bookingPrices.customerGroup, booking.customerGroup)
      )
    )
    .limit(1);
  const rate = booking.unitAmount || price?.amount;
  // A booking with no recorded rate and no surviving price row cannot be priced.
  // Falling through to zero would refund the customer everything they paid and
  // leave the booking standing.
  if (rate === undefined) {
    throw new Error("This booking has no price set. Please contact the Trust.");
  }
  const repeatDiscount = await getRepeatDiscountSettings();
  const amount = bookingAmount(
    rate,
    start,
    end,
    "none",
    !booking.offeringEndTime,
    repeatDiscount,
    "upfront",
    1,
    booking.unitAmount ? booking.pricingPercent : 0
  );
  return { amount, balance: amount - booking.paidAmount };
}

// The same rules readBookingForm applies to a new booking. The picker only
// offers valid slots, but this is a public server action: whatever is posted has
// to satisfy the venue's hours, the offering's days, and its fixed times.
function validateBookingChange(
  booking: ChangeableBooking,
  date: string,
  time: string,
  requestedEndTime: string
) {
  const start = combineDateAndTime(date, booking.offeringStartTime || time);
  const end = booking.offeringEndTime
    ? combineDateAndTime(date, booking.offeringEndTime)
    : requestedEndTime
      ? combineDateAndTime(date, requestedEndTime)
      : addMinutes(start, booking.offeringDurationMinutes ?? 60);

  if (end <= start) throw new Error("The end time must be after the start time.");
  if (
    !booking.offeringEndTime &&
    differenceInHours(end, start) * 60 < (booking.offeringDurationMinutes ?? 60)
  ) {
    throw new Error("That booking would be too short.");
  }
  const startLimit = timeToMinutes(booking.bookableStartTime);
  const endLimit = timeToMinutes(booking.bookableEndTime);
  const sameDay = start.toDateString() === end.toDateString();
  if (!sameDay || bookingMinuteOfDay(start) < startLimit || bookingMinuteOfDay(end) > endLimit) {
    throw new Error(
      `This venue can only be booked between ${booking.bookableStartTime} and ${booking.bookableEndTime}.`
    );
  }
  const allowedDays = booking.offeringAllowedDays ?? [0, 1, 2, 3, 4, 5, 6];
  if (!allowedDays.includes(start.getUTCDay())) {
    throw new Error("That booking is not available on that day.");
  }
  // Matches getAvailableBookingSlots, which offers from the start of the next
  // day: an exact now+24h would reject tomorrow-morning slots the picker shows.
  const earliest = addDays(new Date(), 1);
  earliest.setHours(0, 0, 0, 0);
  if (start < earliest) {
    throw new Error("Bookings must start at least a day from now.");
  }
  return { start, end };
}

export async function previewCustomerBookingChange(
  bookingId: string,
  date: string,
  time: string,
  endTime: string
) {
  const booking = await loadChangeableBooking(bookingId);
  const { start, end } = validateBookingChange(booking, date, time, endTime);
  const quote = await quoteBookingChange(booking, start, end);
  return { ...quote, currentAmount: booking.amount, paidAmount: booking.paidAmount };
}

export async function changeCustomerBooking(formData: FormData) {
  const bookingId = String(formData.get("bookingId") || "");
  const booking = await loadChangeableBooking(bookingId);
  const { start, end } = validateBookingChange(
    booking,
    String(formData.get("date") || ""),
    String(formData.get("time") || ""),
    String(formData.get("endTime") || "")
  );
  const previousStart = booking.startDate;
  const previousEnd = booking.endDate;
  if (previousStart.getTime() === start.getTime() && previousEnd.getTime() === end.getTime()) {
    redirect("/account/bookings");
  }

  // The booking's own hours are excluded, so it can move within the time it
  // already holds; anything else on the facility still blocks it.
  await assertAvailable(
    booking.facilityId,
    booking.offeringCapacity ?? 1,
    [{ startDate: start, endDate: end }],
    bookingId
  );

  const { amount } = await quoteBookingChange(booking, start, end);

  // A change that costs more than has been paid is applied only once it is paid
  // for. Holding the bigger slot on an unpaid balance would let a customer
  // shorten a booking, take the refund, and stretch it straight back out again.
  if (booking.status === "confirmed" && amount > booking.paidAmount) {
    const paymentUrl = await createBookingChangeCheckoutSession(
      bookingId,
      amount - booking.paidAmount,
      { start, end, amount }
    );
    redirect(paymentUrl);
  }

  await db
    .update(bookings)
    .set({
      startDate: start,
      endDate: end,
      amount,
      changeSeq: sql`${bookings.changeSeq} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));
  await db
    .update(bookingOccurrences)
    .set({ startDate: start, endDate: end, allocatedAmount: amount })
    .where(eq(bookingOccurrences.bookingId, bookingId));
  await moveBookingPromotionEvent(bookingId, start, end);

  const settlement =
    amount === booking.amount
      ? ({ outcome: "balanced" } as BookingSettlement)
      : await settleBookingBalance(bookingId);
  await sendBookingChangedEmail(bookingId, { previousStart, previousEnd, settlement });

  const managerEmail = await getBookingManagerEmail();
  if (managerEmail) {
    await sendTemplateEmail({
      key: "booking_manager_notification",
      to: managerEmail,
      variables: {
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: "",
        facilityName: booking.facilityName,
        offeringName: booking.offeringName || "Booking",
        startDate: formatBookingDate(start, "d MMM yyyy, HH:mm"),
        endTime: formatBookingDate(end, "HH:mm"),
        schedule: `Changed by the customer from ${formatBookingDate(previousStart, "d MMM yyyy, HH:mm")}–${formatBookingDate(previousEnd, "HH:mm")}`,
        amount: moneyText(amount),
        notes: "",
      },
      relatedEntityType: "booking",
      relatedEntityId: bookingId,
    });
  }

  await logAudit({
    action: "update",
    entity: "booking",
    entityId: bookingId,
    description: `Customer changed booking to ${formatBookingDate(start, "d MMM yyyy, HH:mm")}–${formatBookingDate(end, "HH:mm")}`,
  });
  revalidatePath("/account/bookings");
  revalidatePath("/admin/bookings");
  revalidatePath("/booking");
  // Straight to checkout when the change costs more, rather than asking them to
  // go and find an email. It is the same Stripe session the email carries, so
  // abandoning here and paying from the email later cannot charge them twice.
  if (settlement.outcome === "charged") redirect(settlement.paymentUrl);
  redirect("/account/bookings");
}

// Lets a customer settle what a change left owing without hunting for the email.
export async function payCustomerBookingBalance(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const bookingId = String(formData.get("bookingId") || "");
  const [booking] = await db
    .select({
      id: bookings.id,
      customerEmail: bookings.customerEmail,
      amount: bookings.amount,
      paidAmount: bookings.paidAmount,
      status: bookings.status,
      paymentType: bookings.paymentType,
      invoiceStatus: bookings.invoiceStatus,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking || booking.customerEmail !== session.user.email.toLowerCase()) {
    throw new Error("Booking not found.");
  }
  const balance = bookingBalance(booking);
  if (balance <= 0) redirect("/account/bookings");
  // A card top-up would not touch a Stripe subscription's price, and paying one
  // alongside an open invoice collects the same money twice.
  if (booking.status !== "confirmed" || booking.paymentType === "subscription") {
    throw new Error("Please contact the Trust to settle this booking.");
  }
  if (booking.invoiceStatus === "open") {
    throw new Error("Please pay the invoice we sent you, or contact the Trust.");
  }

  const paymentUrl = await createBookingTopUpCheckoutSession(bookingId, balance);
  redirect(paymentUrl);
}

export async function getCustomerBookingChange(bookingId: string) {
  const booking = await loadChangeableBooking(bookingId);
  const slots = await getAvailableBookingSlots(booking.offeringId!, bookingId);
  return {
    booking: {
      id: booking.id,
      facilityName: booking.facilityName,
      offeringName: booking.offeringName,
      startDate: booking.startDate,
      endDate: booking.endDate,
      amount: booking.amount,
      paidAmount: booking.paidAmount,
    },
    slots,
  };
}

export async function getAdminBookings() {
  await requireAdmin();
  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      invoiceStatus: bookings.invoiceStatus,
      amount: bookings.amount,
      paidAmount: bookings.paidAmount,
      customerGroup: bookings.customerGroup,
      customerName: bookings.customerName,
      organisationName: bookings.organisationName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      notes: bookings.notes,
      discountCode: bookings.discountCode,
      discountPercent: bookings.discountPercent,
      discountAmount: bookings.discountAmount,
      unitAmount: bookings.unitAmount,
      pricingPercent: bookings.pricingPercent,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      recurrence: bookings.recurrence,
      scheduleType: bookings.scheduleType,
      indefinite: bookings.indefinite,
      billingInterval: bookings.billingInterval,
      repeatCount: bookings.repeatCount,
      promoteOnSite: bookings.promoteOnSite,
      promotionUrl: bookings.promotionUrl,
      stripeSubscriptionId: bookings.stripeSubscriptionId,
      stripeCustomerId: bookings.stripeCustomerId,
      stripeInvoiceId: bookings.stripeInvoiceId,
      invoiceHostedUrl: bookings.invoiceHostedUrl,
      invoicePdfUrl: bookings.invoicePdfUrl,
      billingLine1: bookings.billingLine1,
      billingLine2: bookings.billingLine2,
      billingCity: bookings.billingCity,
      billingPostcode: bookings.billingPostcode,
      cancelledAt: bookings.cancelledAt,
      createdAt: bookings.createdAt,
      updatedAt: bookings.updatedAt,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .orderBy(desc(bookings.startDate));
  const invoices = await latestBookingInvoices(
    rows.filter((row) => row.paymentType === "invoice").map((row) => row.id)
  );
  return rows.map((row) => ({ ...row, invoice: invoices.get(row.id) ?? null }));
}

export async function getAdminBookingOccurrences(bookingIds: string[]) {
  await requireAdmin();
  if (bookingIds.length === 0) return [];
  return db
    .select()
    .from(bookingOccurrences)
    .where(inArray(bookingOccurrences.bookingId, bookingIds))
    .orderBy(asc(bookingOccurrences.startDate));
}

export async function getAdminBooking(id: string) {
  await requireAdmin();
  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      amount: bookings.amount,
      paidAmount: bookings.paidAmount,
      customerGroup: bookings.customerGroup,
      customerName: bookings.customerName,
      organisationName: bookings.organisationName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      notes: bookings.notes,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      recurrence: bookings.recurrence,
      scheduleType: bookings.scheduleType,
      repeatCount: bookings.repeatCount,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      offeringId: bookings.offeringId,
      billingLine1: bookings.billingLine1,
      billingLine2: bookings.billingLine2,
      billingCity: bookings.billingCity,
      billingPostcode: bookings.billingPostcode,
      stripeInvoiceId: bookings.stripeInvoiceId,
      invoiceStatus: bookings.invoiceStatus,
      invoiceHostedUrl: bookings.invoiceHostedUrl,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, id))
    .limit(1);
  return booking ?? null;
}

export async function getAdminBookingSetup() {
  await requireAdmin();
  await ensureDefaultBookingSetup();
  const [setup, cancellationSettings, blocks] = await Promise.all([
    getPublicBookingData(),
    getCancellationSettings(),
    db
    .select({
      id: bookingBlocks.id,
      seriesId: bookingBlocks.seriesId,
      title: bookingBlocks.title,
      startDate: bookingBlocks.startDate,
      endDate: bookingBlocks.endDate,
      facilityName: facilities.name,
      recurrence: bookingBlockSeries.recurrence,
      indefinite: bookingBlockSeries.indefinite,
      repeatCount: bookingBlockSeries.repeatCount,
    })
    .from(bookingBlocks)
    .innerJoin(facilities, eq(bookingBlocks.facilityId, facilities.id))
    .leftJoin(bookingBlockSeries, eq(bookingBlocks.seriesId, bookingBlockSeries.id))
    .orderBy(desc(bookingBlocks.startDate)),
  ]);
  return { ...setup, cancellationSettings, blocks };
}

export async function getAdminAvailability() {
  await requireAdmin();
  const [bookingRows, blockRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        title: bookingOfferings.name,
        customerName: bookings.customerName,
        organisationName: bookings.organisationName,
        status: bookings.status,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
        facilityName: facilities.name,
      })
      .from(bookings)
      .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
      .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
      .where(ne(bookings.status, "cancelled"))
      .orderBy(asc(bookings.startDate)),
    db
      .select({
        id: bookingBlocks.id,
        title: bookingBlocks.title,
        startDate: bookingBlocks.startDate,
        endDate: bookingBlocks.endDate,
        facilityName: facilities.name,
      })
      .from(bookingBlocks)
      .innerJoin(facilities, eq(bookingBlocks.facilityId, facilities.id))
      .orderBy(asc(bookingBlocks.startDate)),
  ]);

  return [
    ...bookingRows.map((booking) => ({
      id: booking.id,
      title: booking.organisationName || booking.title || booking.customerName,
      facilityName: booking.facilityName,
      startDate: booking.startDate,
      endDate: booking.endDate,
      status: booking.status,
      type: "booking" as const,
    })),
    ...blockRows.map((block) => ({
      id: block.id,
      title: block.title,
      facilityName: block.facilityName,
      startDate: block.startDate,
      endDate: block.endDate,
      status: "blocked",
      type: block.title.startsWith("Event: ") ? ("event" as const) : ("block" as const),
    })),
  ];
}

export async function getPublicAvailability() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeEnd = addDays(today, 180);

  const [eventRows, bookingRows] = await Promise.all([
    db
      .select({
        id: events.id,
        title: events.title,
        location: events.location,
        startDate: events.startDate,
        endDate: events.endDate,
      })
      .from(events)
      .where(
        and(
          eq(events.published, true),
          lt(events.startDate, rangeEnd),
          gt(sql`COALESCE(${events.endDate}, ${events.startDate})`, today)
        )
      )
      .orderBy(asc(events.startDate)),
    db
      .select({
        id: bookings.id,
        title: bookingOfferings.name,
        organisationName: bookings.organisationName,
        facilityName: facilities.name,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
      })
      .from(bookings)
      .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
      .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
      .where(
        and(
          eq(bookings.status, "confirmed"),
          eq(bookings.customerGroup, "team_community"),
          lt(bookings.startDate, rangeEnd),
          gt(bookings.endDate, today)
        )
      )
      .orderBy(asc(bookings.startDate)),
  ]);

  return [
    ...eventRows.map((event) => ({
      id: event.id,
      title: event.title,
      facilityName: event.location || "Community event",
      startDate: event.startDate,
      endDate: event.endDate || event.startDate,
      status: "published",
      type: "event" as const,
    })),
    ...bookingRows.map((booking) => ({
      id: booking.id,
      title: booking.organisationName || booking.title || "Team / community booking",
      facilityName: booking.facilityName,
      startDate: booking.startDate,
      endDate: booking.endDate,
      status: "booked",
      type: "booking" as const,
    })),
  ];
}

export async function updateBookingPrice(formData: FormData) {
  await requireAdmin();
  const offeringId = String(formData.get("offeringId") || "");
  const customerGroup = String(formData.get("customerGroup") || "") as CustomerGroup;
  const amount = Math.round(Number(formData.get("amount")) * 100);
  if (!offeringId || !customerGroup || !Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid price.");
  }
  const [existing] = await db
    .select()
    .from(bookingPrices)
    .where(and(eq(bookingPrices.offeringId, offeringId), eq(bookingPrices.customerGroup, customerGroup)))
    .limit(1);

  if (existing) {
    await db
      .update(bookingPrices)
      .set({ amount, updatedAt: new Date() })
      .where(eq(bookingPrices.id, existing.id));
  } else {
    await db.insert(bookingPrices).values({ offeringId, customerGroup, amount });
  }

  await logAudit({ action: "update", entity: "booking", description: "Updated booking price" });
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/bookings/settings");
  revalidatePath("/admin/bookings/availability");
  revalidatePath("/booking");
}

export async function deleteBookingBlock(id: string) {
  await requireAdmin();
  await db.delete(bookingBlocks).where(eq(bookingBlocks.id, id));
  await logAudit({ action: "delete", entity: "booking", entityId: id, description: "Deleted blocked-out time" });
  revalidatePath("/admin/bookings/settings");
  revalidatePath("/admin/bookings/availability");
  revalidatePath("/booking");
}

export async function deleteBookingBlockSeries(id: string) {
  await requireAdmin();
  await db.delete(bookingBlockSeries).where(eq(bookingBlockSeries.id, id));
  await logAudit({ action: "delete", entity: "booking", entityId: id, description: "Deleted recurring blocked-out time series" });
  revalidatePath("/admin/bookings/settings");
  revalidatePath("/admin/bookings/availability");
  revalidatePath("/booking");
}

export async function updateRepeatBookingDiscount(formData: FormData) {
  await requireAdmin();
  const threshold = Math.max(1, Math.round(Number(formData.get("threshold"))));
  const percent = Math.max(0, Math.min(100, Math.round(Number(formData.get("percent")))));
  if (!Number.isFinite(threshold) || !Number.isFinite(percent)) {
    throw new Error("Invalid repeat booking discount.");
  }

  const [settings] = await db.select({ id: siteSettings.id }).from(siteSettings).limit(1);
  const values = {
    repeatBookingDiscountThreshold: threshold,
    repeatBookingDiscountPercent: percent,
    updatedAt: new Date(),
  };

  if (settings) {
    await db.update(siteSettings).set(values).where(eq(siteSettings.id, settings.id));
  } else {
    await db.insert(siteSettings).values(values);
  }

  await logAudit({
    action: "update",
    entity: "booking",
    description: "Updated repeat booking discount",
    metadata: { threshold, percent },
  });
  revalidatePath("/admin/bookings");
  revalidatePath("/booking");
}

export async function updateBookingCancellationSettings(formData: FormData) {
  await requireAdmin();
  const noticeHours = Math.max(0, Math.round(Number(formData.get("noticeHours"))));
  if (!Number.isFinite(noticeHours)) {
    throw new Error("Invalid cancellation notice period.");
  }

  const [settings] = await db.select({ id: siteSettings.id }).from(siteSettings).limit(1);
  const values = {
    bookingCancellationNoticeHours: noticeHours,
    updatedAt: new Date(),
  };

  if (settings) {
    await db.update(siteSettings).set(values).where(eq(siteSettings.id, settings.id));
  } else {
    await db.insert(siteSettings).values(values);
  }

  await logAudit({
    action: "update",
    entity: "booking",
    description: "Updated booking cancellation settings",
    metadata: { noticeHours },
  });
  revalidatePath("/admin/bookings");
  revalidatePath("/account/bookings");
}

export async function updateFacilityBookableHours(formData: FormData) {
  await requireAdmin();
  const facilityId = String(formData.get("facilityId") || "");
  const bookableStartTime = String(formData.get("bookableStartTime") || "");
  const bookableEndTime = String(formData.get("bookableEndTime") || "");
  const startMinutes = timeToMinutes(bookableStartTime);
  const endMinutes = timeToMinutes(bookableEndTime);
  if (!facilityId || endMinutes <= startMinutes) {
    throw new Error("Bookable end time must be after the start time.");
  }

  await db
    .update(facilities)
    .set({
      bookableStartTime,
      bookableEndTime,
      updatedAt: new Date(),
    })
    .where(eq(facilities.id, facilityId));

  await logAudit({
    action: "update",
    entity: "booking",
    entityId: facilityId,
    description: "Updated venue bookable hours",
    metadata: { bookableStartTime, bookableEndTime },
  });
  revalidatePath("/admin/bookings");
  revalidatePath("/booking");
}

export async function createBookingBlock(formData: FormData) {
  const session = await requireAdmin();
  const facilityId = String(formData.get("facilityId") || "");
  const title = String(formData.get("title") || "").trim();
  const startDate = combineDateAndTime(
    String(formData.get("startDate") || ""),
    String(formData.get("startTime") || "")
  );
  const endDate = combineDateAndTime(
    String(formData.get("endDate") || ""),
    String(formData.get("endTime") || "")
  );
  if (!facilityId || !title || endDate <= startDate) throw new Error("Invalid block.");
  const recurrenceValue = String(formData.get("recurrence") || "none");
  const recurrence = recurrenceOptions.find((option) => option.value === recurrenceValue)?.value ?? null;
  const indefinite = formData.get("indefinite") === "on";
  const repeatCount = Math.max(2, Math.min(104, Math.round(Number(formData.get("repeatCount") || 2))));
  const notes = String(formData.get("notes") || "").trim() || null;
  const createdBy = session.user?.id ?? null;

  if (!recurrence) {
    await db.insert(bookingBlocks).values({ facilityId, title, startDate, endDate, notes, createdBy });
  } else {
    const seriesId = createId();
    await db.insert(bookingBlockSeries).values({
      id: seriesId,
      facilityId,
      title,
      startDate,
      endDate,
      recurrence,
      indefinite,
      repeatCount,
      notes,
      createdBy,
    });
    const ranges = indefinite
      ? occurrenceDatesInWindow(startDate, endDate, recurrence, null, addDays(new Date(), SUBSCRIPTION_HORIZON_DAYS))
      : occurrenceDates(startDate, endDate, recurrence, repeatCount);
    await db.insert(bookingBlocks).values(ranges.map((range) => ({
      facilityId,
      seriesId,
      title,
      startDate: range.startDate,
      endDate: range.endDate,
      notes,
      createdBy,
    })));
  }
  await logAudit({ action: "create", entity: "booking", description: `Blocked booking time: ${title}` });
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/bookings/settings");
  revalidatePath("/admin/bookings/availability");
  revalidatePath("/booking");
}

export async function createManualBooking(formData: FormData) {
  await requireAdmin();
  const { offering, price, start, end, recurrence, repeatPaymentMode, repeatCount, billingInterval, recurringAmount } =
    await readBookingForm(formData);
  const repeatDiscount = await getRepeatDiscountSettings();
  const scheduleType = formData.get("scheduleType") === "custom" ? "custom" : "regular";
  const [facilityHours] = await db
    .select({
      bookableStartTime: facilities.bookableStartTime,
      bookableEndTime: facilities.bookableEndTime,
    })
    .from(facilities)
    .where(eq(facilities.id, offering.facilityId))
    .limit(1);
  if (!facilityHours) throw new Error("Invalid venue.");
  const customSessions = scheduleType === "custom"
    ? parseCustomSessions(formData.get("customSessions"), offering, facilityHours)
    : null;

  const manualPaymentMode = String(formData.get("manualPaymentMode") || "confirmed");
  const sendPaymentLink = manualPaymentMode === "payment_link";
  const sendInvoice = manualPaymentMode === "invoice";
  const requiresPayment = sendPaymentLink || sendInvoice;
  // Auto-charged, indefinite subscription: billing cadence is independent of the
  // session cadence and the slot is held with a rolling 180-day occurrence window.
  const isSubscription =
    scheduleType === "regular" && sendPaymentLink && recurrence !== "none" && repeatPaymentMode === "subscription";
  // Invoiced a month at a time, in advance, on the same rolling window.
  const isMonthlyInvoice =
    scheduleType === "regular" && sendInvoice && recurrence !== "none" && repeatPaymentMode === "monthly_invoice";
  const indefinite =
    scheduleType === "regular" && recurrence !== "none" &&
    (isSubscription || isMonthlyInvoice || (!requiresPayment && formData.get("indefinite") === "on"));
  const perSessionAmount = bookingAmount(
    price.amount,
    start,
    end,
    recurrence,
    !offering.endTime,
    repeatDiscount,
    "subscription",
    repeatCount
  );
  const subscriptionAmount = recurringAmount ?? suggestRecurringAmount(perSessionAmount, recurrence, billingInterval);

  const dates = customSessions ?? (indefinite
    ? occurrenceDatesInWindow(start, end, recurrence, null, addDays(new Date(), SUBSCRIPTION_HORIZON_DAYS))
    : occurrenceDates(
        start,
        end,
        recurrence,
        repeatPaymentMode === "upfront" ? repeatCount : defaultSubscriptionOccurrenceCount(recurrence)
      ));
  await assertAvailable(offering.facilityId, offering.capacity, dates);

  const id = createId();
  const promoteOnSite =
    price.customerGroup === "team_community" && formData.get("promoteOnSite") === "on";
  const promotionUrl = promoteOnSite
    ? normalisePromotionUrl(String(formData.get("promotionUrl") || ""))
    : null;
  if (promoteOnSite && !promotionUrl) {
    throw new Error("Add a public link for the promoted event.");
  }
  const customerName = String(formData.get("customerName") || "").trim();
  const organisationName = String(formData.get("organisationName") || "").trim() || null;
  const customerEmail = String(formData.get("customerEmail") || "").trim().toLowerCase();
  if (!customerName || !customerEmail) {
    throw new Error("Customer name and email are required.");
  }
  if ((price.customerGroup === "team_community" || price.customerGroup === "business") && !organisationName) {
    throw new Error("Business, club, or event name is required.");
  }
  const customerPhone = String(formData.get("customerPhone") || "").trim() || null;
  const billingLine1 = String(formData.get("billingLine1") || "").trim() || null;
  const billingLine2 = String(formData.get("billingLine2") || "").trim() || null;
  const billingCity = String(formData.get("billingCity") || "").trim() || null;
  const billingPostcode = String(formData.get("billingPostcode") || "").trim() || null;
  if (sendInvoice && (!billingLine1 || !billingCity || !billingPostcode)) {
    throw new Error("A billing address is required to send an invoice.");
  }
  const userId = await upsertCustomerRecord({
    email: customerEmail,
    name: customerName,
    phone: customerPhone,
  });
  const submittedDiscountCode = String(formData.get("discountCode") || "").trim();
  const codeResult = submittedDiscountCode
    ? await validateBookingDiscountCode(submittedDiscountCode, customerEmail)
    : null;
  if (codeResult && !codeResult.valid) throw new Error(codeResult.message);
  // The subscription flat fee is already net (discounted in the dialog suggestion),
  // so only resolve/apply the customer discount for list-price-derived amounts.
  const customerDiscountPercent = isSubscription
    ? 0
    : await getCustomerDiscountPercent(customerEmail);
  const pricingDiscountPercent = Math.max(
    customerDiscountPercent,
    codeResult?.discountPercent ?? 0
  );
  const customPriceRaw = (() => {
    const raw = String(formData.get("customPrice") || "").trim();
    if (!raw) return undefined;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid custom price.");
    return Math.round(amount * 100);
  })();
  const customRepeatEligible = Boolean(customSessions && customSessions.length >= repeatDiscount.threshold);
  const customEffectivePercent = Math.max(
    pricingDiscountPercent,
    customRepeatEligible ? repeatDiscount.percent : 0
  );
  const regularRepeatEligible =
    recurrence !== "none" && repeatPaymentMode === "upfront" &&
    repeatCount >= repeatDiscount.threshold;
  const regularEffectivePercent = Math.max(
    pricingDiscountPercent,
    regularRepeatEligible ? repeatDiscount.percent : 0
  );
  const customAmounts = customSessions
    ? allocateCustomAmounts(
        customSessions,
        price.amount,
        !offering.endTime,
        repeatDiscount,
        pricingDiscountPercent,
        customPriceRaw === undefined
          ? undefined
          : Math.round((customPriceRaw * (100 - customEffectivePercent)) / 100)
      )
    : null;
  const finalAmount = customAmounts
    ? customAmounts.total
    : isSubscription
    ? Math.round((subscriptionAmount * (100 - (codeResult?.discountPercent ?? 0))) / 100)
    : customPriceRaw !== undefined
    ? Math.round((customPriceRaw * (100 - regularEffectivePercent)) / 100)
    : bookingAmount(
        price.amount,
        start,
        end,
        recurrence,
        !offering.endTime,
        repeatDiscount,
        repeatPaymentMode,
        repeatCount,
        pricingDiscountPercent
      );
  const manualSubtotal = customPriceRaw ?? (customSessions
    ? customSessions.reduce((sum, date) => sum + bookingAmount(
        price.amount, date.startDate, date.endDate, "none", !offering.endTime,
        { threshold: 0, percent: 0 }, "upfront", 1, 0
      ), 0)
    : isSubscription
      ? subscriptionAmount
      : bookingAmount(price.amount, start, end, recurrence, !offering.endTime,
          { ...repeatDiscount, percent: 0 }, repeatPaymentMode, repeatCount, 0));
  // A fully discounted (free) booking can't go through Stripe — confirm it directly.
  const willCharge = requiresPayment && finalAmount > 0;
  await db.insert(bookings).values({
    id,
    userId,
    facilityId: offering.facilityId,
    offeringId: offering.id,
    customerGroup: price.customerGroup,
    customerName,
    organisationName,
    customerEmail,
    customerPhone,
    billingLine1,
    billingLine2,
    billingCity,
    billingPostcode,
    notes: String(formData.get("notes") || "").trim() || null,
    status: willCharge ? "pending_payment" : "confirmed",
    paymentType: isMonthlyInvoice && willCharge
      ? "invoice"
      : isSubscription ? "subscription" : sendPaymentLink ? "one_off" : "manual",
    billingInterval: isMonthlyInvoice && willCharge ? "monthly" : isSubscription ? billingInterval : null,
    amount: finalAmount,
    discountCodeId: codeResult?.id ?? null,
    discountCode: codeResult?.code ?? null,
    discountPercent: Math.max(
      codeResult?.discountPercent ?? 0,
      customerDiscountPercent,
      customRepeatEligible || (recurrence !== "none" && repeatPaymentMode === "upfront" && repeatCount >= repeatDiscount.threshold)
        ? repeatDiscount.percent : 0
    ),
    discountAmount: Math.max(0, manualSubtotal - finalAmount),
    unitAmount: customPriceRaw ?? price.amount,
    pricingPercent: regularEffectivePercent,
    // Nothing to collect means it is settled the moment it is created.
    paidAmount: willCharge ? 0 : finalAmount,
    startDate: dates[0].startDate,
    endDate: dates[0].endDate,
    recurrence,
    scheduleType,
    indefinite,
    repeatCount: scheduleType === "custom" ? dates.length : recurrence !== "none" ? dates.length : 1,
    promoteOnSite,
    promotionUrl,
    requirementSetId: offering.requirementSetId ?? null,
  });
  await db.insert(bookingOccurrences).values(
    dates.map((date, index) => ({
      bookingId: id,
      facilityId: offering.facilityId,
      startDate: date.startDate,
      endDate: date.endDate,
      status: willCharge ? ("pending_payment" as const) : ("confirmed" as const),
      allocatedAmount:
        isMonthlyInvoice && willCharge
          ? 0
          : customAmounts?.allocations[index] ??
            allocateAcrossOccurrences(finalAmount, dates.length)[index] ??
            0,
    }))
  );

  if (willCharge && sendPaymentLink) {
    const paymentUrl = await createBookingStripeCheckoutSession(id);
    await sendManualBookingPaymentLinkEmail(id, paymentUrl);
  } else if (willCharge && isMonthlyInvoice) {
    await issueFirstBookingInvoice(id);
  } else if (willCharge && sendInvoice) {
    await createBookingInvoice(id);
  } else {
    await sendBookingConfirmedEmails(id, true);
    await createPromotionEventForBooking(id);
  }
  await logAudit({ action: "create", entity: "booking", entityId: id, description: "Created manual booking" });
  revalidatePath("/admin/bookings");
  revalidatePath("/booking");
}

export async function updateAdminBooking(id: string, formData: FormData) {
  await requireAdmin();
  const [currentBooking] = await db
    .select({
      scheduleType: bookings.scheduleType,
      paymentType: bookings.paymentType,
      unitAmount: bookings.unitAmount,
      pricingPercent: bookings.pricingPercent,
      amount: bookings.amount,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);
  if (!currentBooking) throw new Error("Booking not found.");
  const { offering, price, start, end, recurrence, repeatPaymentMode, repeatCount } =
    await readBookingForm(formData);
  const repeatDiscount = await getRepeatDiscountSettings();
  const dates = occurrenceDates(
    start,
    end,
    recurrence,
    recurrence !== "none" ? repeatCount : 1
  );
  // A custom schedule is edited session by session, and a monthly-invoiced
  // booking rides a rolling window that rebuilding here would tear up; both
  // take only the details below.
  const detailsOnly = currentBooking.scheduleType === "custom" || currentBooking.paymentType === "invoice";
  if (!detailsOnly) {
    await assertAvailable(offering.facilityId, offering.capacity, dates, id);
  }

  const customerName = String(formData.get("customerName") || "").trim();
  const organisationName = String(formData.get("organisationName") || "").trim() || null;
  const customerEmail = String(formData.get("customerEmail") || "").trim().toLowerCase();
  if (!customerName || !customerEmail) {
    throw new Error("Customer name and email are required.");
  }
  if ((price.customerGroup === "team_community" || price.customerGroup === "business") && !organisationName) {
    throw new Error("Business, club, or event name is required.");
  }
  const userId = await upsertCustomerRecord({
    email: customerEmail,
    name: customerName,
    phone: String(formData.get("customerPhone") || "").trim() || null,
  });
  const customerDiscountPercent = await getCustomerDiscountPercent(customerEmail);

  if (detailsOnly) {
    await db.update(bookings).set({
      userId,
      customerName,
      organisationName,
      customerEmail,
      customerPhone: String(formData.get("customerPhone") || "").trim() || null,
      billingLine1: String(formData.get("billingLine1") || "").trim() || null,
      billingLine2: String(formData.get("billingLine2") || "").trim() || null,
      billingCity: String(formData.get("billingCity") || "").trim() || null,
      billingPostcode: String(formData.get("billingPostcode") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      updatedAt: new Date(),
    }).where(eq(bookings.id, id));
    await logAudit({ action: "update", entity: "booking", entityId: id, description: "Updated booking details" });
    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${id}/edit`);
    return;
  }

  await db
    .update(bookings)
    .set({
      userId,
      facilityId: offering.facilityId,
      offeringId: offering.id,
      customerGroup: price.customerGroup,
      customerName,
      organisationName,
      customerEmail,
      customerPhone: String(formData.get("customerPhone") || "").trim() || null,
      billingLine1: String(formData.get("billingLine1") || "").trim() || null,
      billingLine2: String(formData.get("billingLine2") || "").trim() || null,
      billingCity: String(formData.get("billingCity") || "").trim() || null,
      billingPostcode: String(formData.get("billingPostcode") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      // Reprice on the rate this booking was sold at, so a later change to the
      // price list never rewrites what an existing customer agreed to pay. Only
      // bookings taken before rates were recorded fall back to the list.
      amount: bookingAmount(
        currentBooking.unitAmount || price.amount,
        start,
        end,
        recurrence,
        !offering.endTime,
        repeatDiscount,
        repeatPaymentMode,
        repeatCount,
        currentBooking.unitAmount ? currentBooking.pricingPercent : customerDiscountPercent
      ),
      startDate: start,
      endDate: end,
      recurrence,
      repeatCount: recurrence !== "none" ? repeatCount : 1,
      requirementSetId: offering.requirementSetId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, id));

  const [repriced] = await db
    .select({ amount: bookings.amount, paidAmount: bookings.paidAmount })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);
  const newAllocations = allocateAcrossOccurrences(repriced?.amount ?? 0, dates.length);
  await db.delete(bookingOccurrences).where(eq(bookingOccurrences.bookingId, id));
  await db.insert(bookingOccurrences).values(
    dates.map((date, index) => ({
      bookingId: id,
      facilityId: offering.facilityId,
      startDate: date.startDate,
      endDate: date.endDate,
      status: "confirmed" as const,
      allocatedAmount: newAllocations[index] ?? 0,
    }))
  );
  await db
    .update(bookings)
    .set({ changeSeq: sql`${bookings.changeSeq} + 1` })
    .where(eq(bookings.id, id));

  const balance = (repriced?.amount ?? 0) - (repriced?.paidAmount ?? 0);
  await logAudit({
    action: "update",
    entity: "booking",
    entityId: id,
    description:
      balance === 0
        ? "Updated booking"
        : `Updated booking · ${balance > 0 ? "outstanding" : "refundable"} ${moneyText(Math.abs(balance))}`,
  });

  const timesChanged =
    currentBooking.startDate.getTime() !== start.getTime() ||
    currentBooking.endDate.getTime() !== end.getTime();
  // Only reach for Stripe when the price actually moved. Editing a phone number
  // on an unpaid booking should not expire its checkout link and chase the
  // customer for money they were already asked for.
  const settlement: BookingSettlement =
    (repriced?.amount ?? 0) === currentBooking.amount
      ? { outcome: "balanced" }
      : await settleBookingBalance(id);
  if (timesChanged) {
    await sendBookingChangedEmail(id, {
      previousStart: currentBooking.startDate,
      previousEnd: currentBooking.endDate,
      settlement,
    });
  }
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}/edit`);
  revalidatePath("/booking");
}

// A top-up is its own Stripe payment, separate from the booking's original one,
// so it carries its own metadata and the webhook adds to paid_amount rather than
// replacing it. The booking's checkout session id is left alone: it still points
// at the payment that confirmed the booking.
async function createBookingTopUpCheckoutSession(bookingId: string, amount: number) {
  const [booking] = await db
    .select({
      id: bookings.id,
      customerEmail: bookings.customerEmail,
      startDate: bookings.startDate,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new Error("Booking not found.");
  const schedule = await bookingScheduleText(bookingId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: booking.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: amount,
          product_data: {
            name: `${booking.facilityName} - booking change`,
            description: schedule || formatBookingDate(booking.startDate, "d MMM yyyy, HH:mm"),
          },
        },
      },
    ],
    metadata: { type: "booking_topup", bookingId: booking.id },
    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/account/bookings`,
  });
  if (!checkoutSession.url) throw new Error("Stripe did not return a checkout URL.");
  return checkoutSession.url;
}

async function createBookingChangeCheckoutSession(
  bookingId: string,
  balance: number,
  target: { start: Date; end: Date; amount: number }
) {
  const [booking] = await db
    .select({
      customerEmail: bookings.customerEmail,
      facilityName: facilities.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new Error("Booking not found.");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: booking.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: balance,
          product_data: {
            name: `${booking.facilityName} - booking change`,
            description: `${formatBookingDate(target.start, "d MMM yyyy, HH:mm")}–${formatBookingDate(target.end, "HH:mm")}`,
          },
        },
      },
    ],
    metadata: {
      type: "booking_change",
      bookingId,
      startIso: target.start.toISOString(),
      endIso: target.end.toISOString(),
      newAmount: String(target.amount),
    },
    success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/account/bookings`,
  });
  if (!checkoutSession.url) throw new Error("Stripe did not return a checkout URL.");
  return checkoutSession.url;
}

// Applies a change the customer has just paid for. Idempotent: a webhook retry,
// or the success page racing the webhook, finds the booking already moved and
// does nothing. If the slot went while they were paying, the booking stays put
// and the payment shows in admin as refundable rather than vanishing.
export async function applyPaidBookingChange(
  bookingId: string,
  target: { start: Date; end: Date; amount: number },
  amountPaid: number,
  paymentIntentId?: string | null
) {
  const [booking] = await db
    .select({
      id: bookings.id,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      amount: bookings.amount,
      facilityId: bookings.facilityId,
      offeringId: bookings.offeringId,
      status: bookings.status,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking || booking.status === "cancelled") return;
  if (
    booking.startDate.getTime() === target.start.getTime() &&
    booking.endDate.getTime() === target.end.getTime() &&
    booking.amount === target.amount
  ) {
    return;
  }

  await db
    .update(bookings)
    .set({
      paidAmount: sql`${bookings.paidAmount} + ${amountPaid}`,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));
  await recordBookingPayment({ bookingId, paymentIntentId, amount: amountPaid });

  const [offering] = await db
    .select({ capacity: bookingOfferings.capacity })
    .from(bookingOfferings)
    .where(eq(bookingOfferings.id, booking.offeringId ?? ""))
    .limit(1);
  try {
    await assertAvailable(
      booking.facilityId,
      offering?.capacity ?? 1,
      [{ startDate: target.start, endDate: target.end }],
      bookingId
    );
  } catch {
    await logAudit({
      action: "update",
      entity: "booking",
      entityId: bookingId,
      description: `Paid change to ${formatBookingDate(target.start, "d MMM yyyy, HH:mm")} could not be applied — the slot was taken. ${moneyText(amountPaid)} is refundable.`,
    });
    revalidatePath("/admin/bookings");
    return;
  }

  const previousStart = booking.startDate;
  const previousEnd = booking.endDate;
  await db
    .update(bookings)
    .set({
      startDate: target.start,
      endDate: target.end,
      amount: target.amount,
      changeSeq: sql`${bookings.changeSeq} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));
  await db
    .update(bookingOccurrences)
    .set({ startDate: target.start, endDate: target.end, allocatedAmount: target.amount })
    .where(eq(bookingOccurrences.bookingId, bookingId));
  await moveBookingPromotionEvent(bookingId, target.start, target.end);
  await sendBookingChangedEmail(bookingId, {
    previousStart,
    previousEnd,
    settlement: { outcome: "balanced" },
  });
  await logAudit({
    action: "update",
    entity: "booking",
    entityId: bookingId,
    description: `Customer paid ${moneyText(amountPaid)} and changed booking to ${formatBookingDate(target.start, "d MMM yyyy, HH:mm")}–${formatBookingDate(target.end, "HH:mm")}`,
  });
  revalidatePath("/account/bookings");
  revalidatePath("/admin/bookings");
  revalidatePath("/booking");
  revalidatePath("/events");
}

// A promoted booking appears on the public calendar. When it moves, the event
// moves with it, or the site keeps advertising the old slot.
async function moveBookingPromotionEvent(bookingId: string, start: Date, end: Date) {
  const [booking] = await db
    .select({ promotionEventId: bookings.promotionEventId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  const occurrences = await db
    .select({ promotionEventId: bookingOccurrences.promotionEventId })
    .from(bookingOccurrences)
    .where(eq(bookingOccurrences.bookingId, bookingId));
  const eventIds = new Set(
    [booking?.promotionEventId, ...occurrences.map((row) => row.promotionEventId)].filter(
      (id): id is string => Boolean(id)
    )
  );
  for (const eventId of eventIds) {
    await db.update(events).set({ startDate: start, endDate: end }).where(eq(events.id, eventId));
  }
}

export async function recordBookingTopUpPayment(
  bookingId: string,
  paymentIntentId: string | null | undefined,
  amount: number,
  invoiceId?: string | null
) {
  await recordBookingPayment({ bookingId, paymentIntentId, invoiceId, amount });
}

// Every payment taken against a booking, so a refund can find money paid after
// the original one. Idempotent: Stripe redelivers, and a payment intent only
// ever belongs to one booking.
// A card payment is keyed on its payment intent; a monthly invoice settled by
// bank transfer has none and is keyed on the invoice instead. Either key makes
// a webhook retry a no-op.
async function recordBookingPayment(input: {
  bookingId: string;
  amount: number;
  paymentIntentId?: string | null;
  invoiceId?: string | null;
  paidOutOfBand?: boolean;
}) {
  const { bookingId, amount, paymentIntentId, invoiceId, paidOutOfBand = false } = input;
  if (amount <= 0) return;
  if (paymentIntentId) {
    await db
      .insert(bookingPayments)
      .values({ bookingId, stripePaymentIntentId: paymentIntentId, stripeInvoiceId: invoiceId ?? null, amount, paidOutOfBand })
      .onConflictDoNothing({ target: bookingPayments.stripePaymentIntentId });
    return;
  }
  if (!invoiceId) return;
  await db
    .insert(bookingPayments)
    .values({ bookingId, stripeInvoiceId: invoiceId, amount, paidOutOfBand })
    .onConflictDoNothing({ target: bookingPayments.stripeInvoiceId });
}

// Refunds up to `amount` across a booking's payments, most recent first, and
// reports what it managed. A booking extended and then cancelled has to give
// back the top-up as well as the original payment.
async function refundBookingPayments(bookingId: string, amount: number, reason: string) {
  if (amount <= 0) return 0;
  const payments = await db
    .select()
    .from(bookingPayments)
    .where(eq(bookingPayments.bookingId, bookingId))
    .orderBy(desc(bookingPayments.createdAt));

  let outstanding = amount;
  let refunded = 0;
  for (const payment of payments) {
    if (outstanding <= 0) break;
    const available = payment.amount - payment.refundedAmount;
    if (available <= 0) continue;
    // Money that arrived by bank transfer has nothing for Stripe to refund.
    if (!payment.stripePaymentIntentId || payment.paidOutOfBand) continue;
    const take = Math.min(available, outstanding);
    try {
      await getStripe().refunds.create(
        { payment_intent: payment.stripePaymentIntentId, amount: take },
        { idempotencyKey: `booking-refund-${payment.id}-${payment.refundedAmount + take}` }
      );
    } catch {
      // Leave it on the booking's balance rather than pretending it went out.
      continue;
    }
    await db
      .update(bookingPayments)
      .set({ refundedAmount: payment.refundedAmount + take })
      .where(eq(bookingPayments.id, payment.id));
    outstanding -= take;
    refunded += take;
  }
  if (refunded > 0) {
    await db
      .update(bookings)
      .set({
        paidAmount: sql`greatest(0, ${bookings.paidAmount} - ${refunded})`,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));
    await logAudit({
      action: "update",
      entity: "booking",
      entityId: bookingId,
      description: `Refunded ${moneyText(refunded)} — ${reason}`,
    });
  }
  return refunded;
}

export type BookingSettlement =
  | { outcome: "balanced" }
  | { outcome: "charged"; amount: number; paymentUrl: string }
  | { outcome: "invoiced"; amount: number }
  | { outcome: "refunded"; amount: number }
  | { outcome: "manual"; amount: number; reason: string };

// Brings the money in line with what a booking now costs. Positive balance is
// collected, negative is refunded, and anything that cannot be settled on its
// own is left standing as a visible balance for an admin to clear by hand.
export async function settleBookingBalance(bookingId: string): Promise<BookingSettlement> {
  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      amount: bookings.amount,
      paidAmount: bookings.paidAmount,
      changeSeq: bookings.changeSeq,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      stripeCheckoutSessionId: bookings.stripeCheckoutSessionId,
      stripeInvoiceId: bookings.stripeInvoiceId,
      invoiceStatus: bookings.invoiceStatus,
      startDate: bookings.startDate,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) throw new Error("Booking not found.");

  // A monthly-invoiced booking settles invoice by invoice; there is no balance
  // on the booking itself to move.
  if (booking.paymentType === "invoice") return { outcome: "balanced" };
  const balance = booking.amount - booking.paidAmount;
  if (balance === 0) return { outcome: "balanced" };
  if (booking.status === "cancelled") {
    return { outcome: "manual", amount: balance, reason: "The booking is cancelled." };
  }
  // Changing a subscription means changing its Stripe price mid-cycle, which is
  // out of scope: leave the balance showing so it is settled deliberately.
  if (booking.paymentType === "subscription") {
    return { outcome: "manual", amount: balance, reason: "Subscription bookings are settled by hand." };
  }

  const schedule = (await bookingScheduleText(bookingId)) ||
    formatBookingDate(booking.startDate, "d MMM yyyy, HH:mm");

  if (balance < 0) {
    const refundAmount = -balance;
    const refunded = await refundBookingPayments(bookingId, refundAmount, "booking change");
    if (refunded === 0) {
      return { outcome: "manual", amount: balance, reason: "No card payment to refund against." };
    }
    if (refunded < refundAmount) {
      // Part of it went back; the rest stays on the balance to be settled by hand.
      return {
        outcome: "manual",
        amount: -(refundAmount - refunded),
        reason: `Only ${moneyText(refunded)} could be refunded to the card.`,
      };
    }
    return { outcome: "refunded", amount: refunded };
  }

  // An unpaid invoice or checkout link is reissued for the new total rather than
  // topped up, or the customer would be asked for the money twice.
  if (booking.invoiceStatus === "open" && booking.stripeInvoiceId) {
    await getStripe().invoices.voidInvoice(booking.stripeInvoiceId);
    await db
      .update(bookings)
      .set({
        stripeInvoiceId: null,
        invoiceStatus: null,
        invoiceHostedUrl: null,
        invoicePdfUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));
    await createBookingInvoice(bookingId);
    return { outcome: "invoiced", amount: balance };
  }
  if (booking.status === "pending_payment") {
    if (booking.stripeCheckoutSessionId) {
      try {
        await getStripe().checkout.sessions.expire(booking.stripeCheckoutSessionId);
      } catch {
        // Already completed or expired — nothing to expire.
      }
    }
    const paymentUrl = await createBookingStripeCheckoutSession(bookingId);
    await sendManualBookingPaymentLinkEmail(bookingId, paymentUrl);
    return { outcome: "charged", amount: balance, paymentUrl };
  }

  const paymentUrl = await createBookingTopUpCheckoutSession(bookingId, balance);
  await sendTemplateEmail({
    key: "booking_change_payment_link",
    to: booking.customerEmail,
    variables: {
      customerName: booking.customerName,
      facilityName: booking.facilityName,
      offeringName: booking.offeringName || "Booking",
      schedule,
      amount: moneyText(booking.amount),
      paidAmount: moneyText(booking.paidAmount),
      balance: moneyText(balance),
      paymentUrl,
    },
    relatedEntityType: "booking",
    relatedEntityId: bookingId,
  });
  await logAudit({
    action: "update",
    entity: "booking",
    entityId: bookingId,
    description: `Sent a payment link for ${moneyText(balance)} after a booking change`,
  });
  return { outcome: "charged", amount: balance, paymentUrl };
}

// Records money that moved outside Stripe — a bank transfer in, or a refund made
// by hand — so the balance goes back to zero.
export async function recordBookingSettlement(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("bookingId") || "");
  const [booking] = await db
    .select({
      amount: bookings.amount,
      paidAmount: bookings.paidAmount,
      status: bookings.status,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);
  if (!booking) throw new Error("Booking not found.");
  const balance = bookingBalance(booking);
  if (balance === 0) return;

  // Clearing the balance means matching what has been paid to what is owed. A
  // cancelled booking owes nothing, so settling it means the money has gone
  // back; anything else is settled by the price being covered.
  await db
    .update(bookings)
    .set({
      paidAmount: booking.status === "cancelled" ? 0 : booking.amount,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, id));
  await logAudit({
    action: "update",
    entity: "booking",
    entityId: id,
    description:
      balance > 0
        ? `Recorded ${moneyText(balance)} received outside Stripe`
        : `Recorded ${moneyText(-balance)} refunded outside Stripe`,
  });
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}/edit`);
}

export async function cancelAdminBooking(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("bookingId") || "");
  const shouldRefund = formData.get("refund") === "true";
  // Stop billing first: a subscription booking left running in Stripe would keep
  // charging the customer's card even after we mark it cancelled here.
  const [booking] = await db
    .select({
      paymentType: bookings.paymentType,
      status: bookings.status,
      paidAmount: bookings.paidAmount,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      stripeSubscriptionId: bookings.stripeSubscriptionId,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);
  if (!booking) throw new Error("Booking not found.");
  if (booking.status === "cancelled") throw new Error("This booking is already cancelled.");

  if (shouldRefund) {
    if (booking.paymentType !== "one_off" || !booking.stripePaymentIntentId) {
      throw new Error("This booking does not have a refundable card payment.");
    }
    await refundBookingPayments(id, booking.paidAmount, "booking cancelled");
  }
  if (booking?.paymentType === "subscription" && booking.stripeSubscriptionId) {
    await getStripe().subscriptions.cancel(booking.stripeSubscriptionId);
  }
  if (booking.paymentType === "invoice") {
    await voidOpenMonthlyInvoices(id);
    await markPaidFutureOccurrencesRefundDue(id);
  }
  await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(bookings.id, id));
  await db
    .update(bookingOccurrences)
    .set({ status: "cancelled" })
    .where(eq(bookingOccurrences.bookingId, id));
  await sendBookingCancellationEmails(id);
  await logAudit({
    action: "delete",
    entity: "booking",
    entityId: id,
    description: shouldRefund ? "Cancelled and refunded booking" : "Cancelled booking",
  });
  revalidatePath("/admin/bookings");
  revalidatePath("/booking");
}

export async function deleteAdminBooking(id: string) {
  await requireAdmin();
  const [booking] = await db
    .select({
      customerName: bookings.customerName,
      facilityId: bookings.facilityId,
      stripeCheckoutSessionId: bookings.stripeCheckoutSessionId,
      stripeSubscriptionId: bookings.stripeSubscriptionId,
      stripeInvoiceId: bookings.stripeInvoiceId,
      promotionEventId: bookings.promotionEventId,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);
  if (!booking) throw new Error("Booking not found.");

  // Stop anything that could charge the customer after the local record has
  // gone. Completed card payments are deliberately not refunded by deletion.
  const stripe = process.env.STRIPE_SECRET_KEY ? getStripe() : null;
  if (stripe && booking.stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(booking.stripeSubscriptionId);
    if (subscription.status !== "canceled") {
      await stripe.subscriptions.cancel(booking.stripeSubscriptionId);
    }
  }
  if (stripe && booking.stripeCheckoutSessionId) {
    const checkout = await stripe.checkout.sessions.retrieve(booking.stripeCheckoutSessionId);
    if (checkout.status === "open") {
      await stripe.checkout.sessions.expire(booking.stripeCheckoutSessionId);
    }
  }
  if (stripe && booking.stripeInvoiceId) {
    const invoice = await stripe.invoices.retrieve(booking.stripeInvoiceId);
    if (invoice.status === "draft") {
      await stripe.invoices.del(booking.stripeInvoiceId);
    } else if (invoice.status === "open") {
      await stripe.invoices.voidInvoice(booking.stripeInvoiceId);
    }
  }
  if (stripe) await voidOpenMonthlyInvoices(id);

  const [documents, occurrenceEvents] = await Promise.all([
    db
      .select({ fileUrl: bookingRequirementDocuments.fileUrl })
      .from(bookingRequirementDocuments)
      .where(eq(bookingRequirementDocuments.bookingId, id)),
    db
      .select({ promotionEventId: bookingOccurrences.promotionEventId })
      .from(bookingOccurrences)
      .where(eq(bookingOccurrences.bookingId, id)),
  ]);
  const promotionEventIds = Array.from(new Set([
    booking.promotionEventId,
    ...occurrenceEvents.map((item) => item.promotionEventId),
  ].filter((eventId): eventId is string => Boolean(eventId))));

  await db.delete(bookings).where(eq(bookings.id, id));
  if (promotionEventIds.length) {
    await db.delete(events).where(inArray(events.id, promotionEventIds));
  }
  if (documents.length) {
    await Promise.allSettled(documents.map((document) => del(document.fileUrl)));
  }

  await logAudit({
    action: "delete",
    entity: "booking",
    entityId: id,
    description: `Permanently deleted booking for ${booking.customerName}`,
  });
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/bookings/availability");
  revalidatePath("/booking");
  revalidatePath("/events");
}

export async function cancelAdminBookingOccurrence(formData: FormData) {
  const session = await requireAdmin();
  const occurrenceId = String(formData.get("occurrenceId") || "");
  const [row] = await db
    .select({
      occurrence: bookingOccurrences,
      bookingId: bookings.id,
      bookingStatus: bookings.status,
      paymentType: bookings.paymentType,
      invoiceStatus: bookings.invoiceStatus,
      stripeInvoiceId: bookings.stripeInvoiceId,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      stripeCheckoutSessionId: bookings.stripeCheckoutSessionId,
      amount: bookings.amount,
    })
    .from(bookingOccurrences)
    .innerJoin(bookings, eq(bookingOccurrences.bookingId, bookings.id))
    .where(eq(bookingOccurrences.id, occurrenceId))
    .limit(1);
  if (!row || row.occurrence.status === "cancelled") throw new Error("Session not found or already cancelled.");

  let refundStatus: "none" | "due" | "refunded" = "none";
  let refundedAt: Date | null = null;
  let refundedBy: string | null = null;
  if (row.bookingStatus === "confirmed" && row.occurrence.allocatedAmount > 0) {
    if (row.paymentType === "one_off" && row.stripePaymentIntentId) {
      const refunded = await refundBookingPayments(
        row.bookingId,
        row.occurrence.allocatedAmount,
        "session cancelled"
      );
      refundStatus = refunded > 0 ? "refunded" : "due";
      refundedAt = refunded > 0 ? new Date() : null;
      refundedBy = refunded > 0 ? session.user?.id ?? null : null;
    } else if (row.invoiceStatus === "paid") {
      refundStatus = "due";
    }
  }

  // A monthly-invoiced session belongs to whichever invoice covers its month:
  // a paid one owes a refund, an open one is reissued without it.
  const [monthlyInvoice] =
    row.paymentType === "invoice"
      ? await db
          .select()
          .from(bookingInvoices)
          .where(
            and(
              eq(bookingInvoices.bookingId, row.bookingId),
              inArray(bookingInvoices.status, ["open", "paid"]),
              lte(bookingInvoices.periodStart, row.occurrence.startDate),
              gt(bookingInvoices.periodEnd, row.occurrence.startDate)
            )
          )
          .limit(1)
      : [];
  if (monthlyInvoice?.status === "paid" && row.occurrence.allocatedAmount > 0) {
    refundStatus = "due";
  }

  if (row.invoiceStatus === "open" && row.stripeInvoiceId) {
    await getStripe().invoices.voidInvoice(row.stripeInvoiceId);
  }

  if (row.bookingStatus === "pending_payment" && row.stripeCheckoutSessionId) {
    try {
      await getStripe().checkout.sessions.expire(row.stripeCheckoutSessionId);
    } catch {
      // A completed or already-expired session needs no further action here.
    }
  }
  await db
    .update(bookingOccurrences)
    .set({
      status: "cancelled",
      refundStatus,
      refundAmount: refundStatus === "none" ? 0 : row.occurrence.allocatedAmount,
      refundedAt,
      refundedBy,
    })
    .where(eq(bookingOccurrences.id, occurrenceId));
  if (row.occurrence.promotionEventId) {
    await db.delete(events).where(eq(events.id, row.occurrence.promotionEventId));
  }

  const remaining = await db
    .select()
    .from(bookingOccurrences)
    .where(and(eq(bookingOccurrences.bookingId, row.bookingId), ne(bookingOccurrences.status, "cancelled")))
    .orderBy(asc(bookingOccurrences.startDate));
  await db
    .update(bookings)
    .set({
      status: remaining.length === 0 ? "cancelled" : row.bookingStatus,
      cancelledAt: remaining.length === 0 ? new Date() : null,
      repeatCount: remaining.length,
      // A monthly-invoiced booking's amount is its per-session rate, not a total.
      amount: row.paymentType === "invoice" ? row.amount : Math.max(0, row.amount - row.occurrence.allocatedAmount),
      startDate: remaining[0]?.startDate ?? row.occurrence.startDate,
      endDate: remaining[0]?.endDate ?? row.occurrence.endDate,
      stripeCheckoutSessionId: row.bookingStatus === "pending_payment" ? null : undefined,
      stripeInvoiceId: row.invoiceStatus === "open" ? null : undefined,
      invoiceStatus: row.invoiceStatus === "open" ? null : undefined,
      invoiceHostedUrl: row.invoiceStatus === "open" ? null : undefined,
      invoicePdfUrl: row.invoiceStatus === "open" ? null : undefined,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, row.bookingId));

  if (row.bookingStatus === "pending_payment" && remaining.length > 0 && row.paymentType === "one_off") {
    const paymentUrl = await createBookingStripeCheckoutSession(row.bookingId);
    await sendManualBookingPaymentLinkEmail(row.bookingId, paymentUrl);
  }
  if (row.invoiceStatus === "open" && remaining.length > 0) {
    await createBookingInvoice(row.bookingId);
  }
  if (monthlyInvoice?.status === "open") {
    await voidMonthlyInvoiceRow(monthlyInvoice);
    if (remaining.length > 0) {
      await issueMonthlyBookingInvoice(
        row.bookingId,
        { start: monthlyInvoice.periodStart, end: monthlyInvoice.periodEnd },
        monthlyInvoice.dueDate,
        monthlyInvoice.revision + 1
      );
    }
  }
  await logAudit({
    action: "delete",
    entity: "booking",
    entityId: row.bookingId,
    description: `Cancelled booking session on ${formatBookingDate(row.occurrence.startDate, "d MMM yyyy, HH:mm")}`,
    metadata: { occurrenceId, refundStatus, refundAmount: row.occurrence.allocatedAmount },
  });
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${row.bookingId}/edit`);
  revalidatePath("/booking");
  revalidatePath("/events");
}

export async function markOccurrenceRefunded(formData: FormData) {
  const session = await requireAdmin();
  const occurrenceId = String(formData.get("occurrenceId") || "");
  const [occurrence] = await db
    .select()
    .from(bookingOccurrences)
    .where(eq(bookingOccurrences.id, occurrenceId))
    .limit(1);
  if (!occurrence || occurrence.refundStatus !== "due") throw new Error("No refund is due.");
  await db
    .update(bookingOccurrences)
    .set({ refundStatus: "refunded", refundedAt: new Date(), refundedBy: session.user?.id ?? null })
    .where(eq(bookingOccurrences.id, occurrenceId));
  await logAudit({
    action: "update",
    entity: "booking",
    entityId: occurrence.bookingId,
    description: "Marked occurrence refund as paid",
    metadata: { occurrenceId, refundAmount: occurrence.refundAmount },
  });
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${occurrence.bookingId}/edit`);
}

export async function saveCustomBookingOccurrence(formData: FormData) {
  await requireAdmin();
  const bookingId = String(formData.get("bookingId") || "");
  const occurrenceId = String(formData.get("occurrenceId") || "");
  const [booking] = await db
    .select({
      id: bookings.id,
      scheduleType: bookings.scheduleType,
      status: bookings.status,
      paymentType: bookings.paymentType,
      amount: bookings.amount,
      customerEmail: bookings.customerEmail,
      invoiceStatus: bookings.invoiceStatus,
      stripeCheckoutSessionId: bookings.stripeCheckoutSessionId,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      offering: bookingOfferings,
      facilityBookableStartTime: facilities.bookableStartTime,
      facilityBookableEndTime: facilities.bookableEndTime,
      priceAmount: bookingPrices.amount,
    })
    .from(bookings)
    .innerJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .innerJoin(
      bookingPrices,
      and(eq(bookingPrices.offeringId, bookings.offeringId), eq(bookingPrices.customerGroup, bookings.customerGroup))
    )
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking || booking.scheduleType !== "custom" || booking.status === "cancelled") {
    throw new Error("Custom booking not found.");
  }
  const [next] = parseCustomSessions(
    JSON.stringify([{ date: formData.get("date"), startTime: formData.get("time"), endTime: formData.get("endTime") }]),
    booking.offering,
    {
      bookableStartTime: booking.facilityBookableStartTime,
      bookableEndTime: booking.facilityBookableEndTime,
    },
    1
  );
  const target = { startDate: next.startDate, endDate: next.endDate };
  const existing = occurrenceId
    ? (await db.select().from(bookingOccurrences).where(and(
        eq(bookingOccurrences.id, occurrenceId),
        eq(bookingOccurrences.bookingId, bookingId)
      )).limit(1))[0]
    : null;
  const financiallyLocked = Boolean(
    booking.invoiceStatus || booking.stripeCheckoutSessionId || booking.stripePaymentIntentId
  );
  if (occurrenceId && !existing) throw new Error("Session not found.");
  const siblings = await db.select().from(bookingOccurrences).where(and(
    eq(bookingOccurrences.bookingId, bookingId),
    ne(bookingOccurrences.status, "cancelled")
  ));
  if (siblings.some((item) => item.id !== occurrenceId && item.startDate < target.endDate && item.endDate > target.startDate)) {
    throw new Error("Custom sessions cannot overlap.");
  }
  await assertAvailable(booking.offering.facilityId, booking.offering.capacity, [target], bookingId);

  if (existing) {
    const oldMinutes = existing.endDate.getTime() - existing.startDate.getTime();
    const newMinutes = target.endDate.getTime() - target.startDate.getTime();
    if (financiallyLocked && oldMinutes !== newMinutes) {
      throw new Error("Paid sessions can only be moved without changing their duration.");
    }
    await db.update(bookingOccurrences).set(target).where(eq(bookingOccurrences.id, existing.id));
    if (existing.promotionEventId) {
      await db.update(events).set(target).where(eq(events.id, existing.promotionEventId));
    }
  } else {
    if (financiallyLocked || booking.paymentType !== "manual") {
      throw new Error("Create a separate booking to add sessions after payment has been arranged.");
    }
    const discount = await getCustomerDiscountPercent(booking.customerEmail);
    const allocatedAmount = bookingAmount(
      booking.priceAmount,
      target.startDate,
      target.endDate,
      "none",
      !booking.offering.endTime,
      { threshold: 999, percent: 0 },
      "upfront",
      1,
      discount
    );
    await db.insert(bookingOccurrences).values({
      bookingId,
      facilityId: booking.offering.facilityId,
      ...target,
      status: booking.status === "confirmed" ? "confirmed" : "pending_payment",
      allocatedAmount,
    });
    await db.update(bookings).set({ amount: booking.amount + allocatedAmount }).where(eq(bookings.id, bookingId));
  }
  const active = await db.select().from(bookingOccurrences).where(and(
    eq(bookingOccurrences.bookingId, bookingId),
    ne(bookingOccurrences.status, "cancelled")
  )).orderBy(asc(bookingOccurrences.startDate));
  await db.update(bookings).set({
    startDate: active[0].startDate,
    endDate: active[0].endDate,
    repeatCount: active.length,
    updatedAt: new Date(),
  }).where(eq(bookings.id, bookingId));
  await createPromotionEventForBooking(bookingId);
  await logAudit({
    action: "update",
    entity: "booking",
    entityId: bookingId,
    description: existing ? "Rescheduled custom booking session" : "Added custom booking session",
    metadata: { occurrenceId: existing?.id ?? null, startDate: target.startDate },
  });
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}/edit`);
  revalidatePath("/booking");
  revalidatePath("/events");
}
