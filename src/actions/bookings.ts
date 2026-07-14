"use server";

import { addDays, addHours, addMonths, addWeeks, addYears, differenceInHours, format } from "date-fns";
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  bookingBlocks,
  bookingOccurrences,
  bookingOfferings,
  bookingPrices,
  bookings,
  events,
  facilities,
  siteSettings,
  users,
} from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import {
  customerGroups,
  recurrenceLabel,
  recurrenceOptions,
  suggestRecurringAmount,
  type CustomerGroup,
  type Recurrence,
} from "@/lib/bookings";
import { sendTemplateEmail } from "@/lib/email/send";
import { upsertCustomerRecord } from "@/actions/customer-records";

const publicFacilitySlugs = ["village-hall", "pavilion", "tennis-courts"];
const defaultRepeatDiscount = {
  threshold: 8,
  percent: 15,
};
const defaultCancellationNoticeHours = 48;

function parseLocalDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
}

function combineDateAndTime(dateValue: string, timeValue: string) {
  if (!/^(?:[01]\d|2[0-3]):00$/.test(timeValue)) {
    throw new Error("Start times must be on the hour.");
  }
  return parseLocalDateTime(`${dateValue}T${timeValue}`);
}

function timeToMinutes(timeValue: string) {
  if (!/^(?:[01]\d|2[0-3]):00$/.test(timeValue)) {
    throw new Error("Times must be on the hour.");
  }
  const [hours] = timeValue.split(":").map(Number);
  return hours * 60;
}

function dateMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
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
  return {
    ...booking,
    variables: {
      customerName: booking.customerName,
      organisationName: booking.organisationName || "",
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone || "Not provided",
      notes: booking.notes || "None",
      amount: moneyText(booking.amount),
      startDate: format(booking.startDate, "d MMM yyyy, HH:mm"),
      endTime: format(booking.endDate, "HH:mm"),
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
                ? `${recurrenceLabel(booking.recurrence)} session, billed ${recurrenceLabel(billingInterval).toLowerCase()}, from ${format(booking.startDate, "d MMM yyyy")}`
                : format(booking.startDate, "d MMM yyyy, HH:mm"),
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

  // Reuse or create the Stripe customer, then persist the id so retries reuse it.
  let customerId = booking.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
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
      metadata: { type: "booking_invoice", bookingId },
    });
    customerId = customer.id;
    await db
      .update(bookings)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));
  }

  // Build the BACS bank-transfer instructions shown on the invoice.
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

  await stripe.invoiceItems.create({
    customer: customerId,
    currency: "gbp",
    amount: booking.amount,
    description: `${booking.facilityName} - ${booking.offeringName || "Booking"} · ${format(booking.startDate, "d MMM yyyy, HH:mm")}`,
  });

  const invoice = await stripe.invoices.create(
    {
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: settings?.invoiceDaysUntilDue ?? 14,
      auto_advance: true,
      pending_invoice_items_behavior: "include",
      description: `Booking at ${booking.facilityName}`,
      footer: footerLines.join("\n") || undefined,
      custom_fields: customFields.length ? customFields.slice(0, 4) : undefined,
      payment_settings: { payment_method_types: ["card"] },
      metadata: { type: "booking_invoice", bookingId },
    },
    { idempotencyKey: `booking-invoice-${bookingId}` }
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
    .set({ invoiceStatus: "paid", updatedAt: new Date() })
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

// Keeps indefinite subscription bookings topped up with a rolling ~180-day
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
        eq(bookings.paymentType, "subscription"),
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
          date: format(range.startDate, "d MMM yyyy, HH:mm"),
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

export async function getAvailableBookingSlots(offeringId: string) {
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
  const customerGroup = String(formData.get("customerGroup") || "") as CustomerGroup;
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const requestedEndTime = String(formData.get("endTime") || "");
  const recurrenceValue = String(formData.get("recurrence") || "none");
  const recurrence: Recurrence =
    recurrenceOptions.some((option) => option.value === recurrenceValue)
      ? (recurrenceValue as Recurrence)
      : "none";
  const repeatPaymentMode: "subscription" | "upfront" =
    recurrence !== "none" && formData.get("repeatPaymentMode") === "upfront"
      ? "upfront"
      : "subscription";
  const repeatCount = recurrence !== "none"
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
  const startMinutes = dateMinutes(start);
  const endMinutes = dateMinutes(end);
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

function bookingAmount(
  baseAmount: number,
  start: Date,
  end: Date,
  recurrence: Recurrence,
  variableDuration: boolean,
  repeatDiscount: { threshold: number; percent: number },
  repeatPaymentMode: "subscription" | "upfront",
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
  return applyPct(amount); // subscription: per-cycle
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
    !booking.promotionUrl ||
    booking.promotionEventId
  ) {
    return;
  }

  const eventId = createId();
  await db.insert(events).values({
    id: eventId,
    title: booking.organisationName || booking.customerName || booking.offeringName || "Team / community booking",
    description: promotionDescription(booking.facilityName, booking.promotionUrl),
    location: booking.facilityName,
    startDate: booking.startDate,
    endDate: booking.endDate,
    allDay: false,
    externalUrl: booking.promotionUrl,
    published: true,
    createdBy: booking.createdBy,
  });
  await db
    .update(bookings)
    .set({ promotionEventId: eventId, updatedAt: new Date() })
    .where(eq(bookings.id, booking.id));
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
  const dates = occurrenceDates(
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
  if (!customerName) throw new Error("Name is required.");
  if ((price.customerGroup === "team_community" || price.customerGroup === "business") && !organisationName) {
    throw new Error("Business, club, or event name is required.");
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
  const amount = bookingAmount(
    price.amount,
    start,
    end,
    recurrence,
    !offering.endTime,
    repeatDiscount,
    repeatPaymentMode,
    repeatCount,
    customer.discountPercent
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
      : recurrence !== "none" && repeatPaymentMode === "subscription"
        ? "subscription"
        : "one_off",
    amount,
    startDate: start,
    endDate: end,
    recurrence,
    repeatCount: recurrence !== "none" ? dates.length : 1,
    promoteOnSite,
    promotionUrl,
    requirementSetId: offering.requirementSetId ?? null,
  });
  await db.insert(bookingOccurrences).values(
    dates.map((date) => ({
      bookingId,
      facilityId: offering.facilityId,
      startDate: date.startDate,
      endDate: date.endDate,
      status: isFree ? ("confirmed" as const) : ("pending_payment" as const),
    }))
  );

  if (isFree) {
    await sendBookingConfirmedEmails(bookingId);
    await createPromotionEventForBooking(bookingId);
    redirect("/booking/success");
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
                ? `${recurrenceLabel(recurrence)} booking from ${format(start, "d MMM yyyy")}`
                : recurrence !== "none"
                  ? `${repeatCount} ${recurrenceLabel(recurrence).toLowerCase()} bookings from ${format(start, "d MMM yyyy")}`
                : format(start, "d MMM yyyy, HH:mm"),
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
  if (!booking) return null;

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

  return db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      amount: bookings.amount,
      organisationName: bookings.organisationName,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      recurrence: bookings.recurrence,
      stripeCheckoutSessionId: bookings.stripeCheckoutSessionId,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .where(eq(bookings.customerEmail, session.user.email.toLowerCase()))
    .orderBy(desc(bookings.startDate));
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
    if (differenceInHours(booking.startDate, new Date()) < cancellationSettings.noticeHours) {
      throw new Error(
        `Bookings can only be cancelled online at least ${cancellationSettings.noticeHours} hours before the start time.`
      );
    }

    if (booking.paymentType === "one_off" && booking.stripePaymentIntentId) {
      await getStripe().refunds.create({ payment_intent: booking.stripePaymentIntentId });
    }
    if (booking.paymentType === "subscription" && booking.stripeSubscriptionId) {
      await getStripe().subscriptions.cancel(booking.stripeSubscriptionId);
    }
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

export async function getAdminBookings() {
  await requireAdmin();
  return db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      invoiceStatus: bookings.invoiceStatus,
      amount: bookings.amount,
      customerName: bookings.customerName,
      organisationName: bookings.organisationName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      recurrence: bookings.recurrence,
      repeatCount: bookings.repeatCount,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .orderBy(desc(bookings.startDate));
}

export async function getAdminBooking(id: string) {
  await requireAdmin();
  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      amount: bookings.amount,
      customerGroup: bookings.customerGroup,
      customerName: bookings.customerName,
      organisationName: bookings.organisationName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      notes: bookings.notes,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      recurrence: bookings.recurrence,
      repeatCount: bookings.repeatCount,
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
      title: bookingBlocks.title,
      startDate: bookingBlocks.startDate,
      endDate: bookingBlocks.endDate,
      facilityName: facilities.name,
    })
    .from(bookingBlocks)
    .innerJoin(facilities, eq(bookingBlocks.facilityId, facilities.id))
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

  await db.insert(bookingBlocks).values({
    facilityId,
    title,
    startDate,
    endDate,
    notes: String(formData.get("notes") || "").trim() || null,
    createdBy: session.user?.id ?? null,
  });
  await logAudit({ action: "create", entity: "booking", description: `Blocked booking time: ${title}` });
  revalidatePath("/admin/bookings");
  revalidatePath("/booking");
}

export async function createManualBooking(formData: FormData) {
  await requireAdmin();
  const { offering, price, start, end, recurrence, repeatPaymentMode, repeatCount, billingInterval, recurringAmount } =
    await readBookingForm(formData);
  const repeatDiscount = await getRepeatDiscountSettings();

  const manualPaymentMode = String(formData.get("manualPaymentMode") || "confirmed");
  const sendPaymentLink = manualPaymentMode === "payment_link";
  const sendInvoice = manualPaymentMode === "invoice";
  const requiresPayment = sendPaymentLink || sendInvoice;
  // Auto-charged, indefinite subscription: billing cadence is independent of the
  // session cadence and the slot is held with a rolling 180-day occurrence window.
  const isSubscription =
    sendPaymentLink && recurrence !== "none" && repeatPaymentMode === "subscription";
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

  const dates = isSubscription
    ? occurrenceDatesInWindow(start, end, recurrence, null, addDays(new Date(), SUBSCRIPTION_HORIZON_DAYS))
    : occurrenceDates(
        start,
        end,
        recurrence,
        repeatPaymentMode === "upfront" ? repeatCount : defaultSubscriptionOccurrenceCount(recurrence)
      );
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
  // The subscription flat fee is already net (discounted in the dialog suggestion),
  // so only resolve/apply the customer discount for list-price-derived amounts.
  const customerDiscountPercent = isSubscription
    ? 0
    : await getCustomerDiscountPercent(customerEmail);
  const finalAmount = isSubscription
    ? subscriptionAmount
    : bookingAmount(
        price.amount,
        start,
        end,
        recurrence,
        !offering.endTime,
        repeatDiscount,
        repeatPaymentMode,
        repeatCount,
        customerDiscountPercent
      );
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
    paymentType: isSubscription ? "subscription" : sendPaymentLink ? "one_off" : "manual",
    billingInterval: isSubscription ? billingInterval : null,
    amount: finalAmount,
    startDate: start,
    endDate: end,
    recurrence,
    repeatCount: recurrence !== "none" ? dates.length : 1,
    promoteOnSite,
    promotionUrl,
    requirementSetId: offering.requirementSetId ?? null,
  });
  await db.insert(bookingOccurrences).values(
    dates.map((date) => ({
      bookingId: id,
      facilityId: offering.facilityId,
      startDate: date.startDate,
      endDate: date.endDate,
      status: willCharge ? ("pending_payment" as const) : ("confirmed" as const),
    }))
  );

  if (willCharge && sendPaymentLink) {
    const paymentUrl = await createBookingStripeCheckoutSession(id);
    await sendManualBookingPaymentLinkEmail(id, paymentUrl);
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
  const { offering, price, start, end, recurrence, repeatPaymentMode, repeatCount } =
    await readBookingForm(formData);
  const repeatDiscount = await getRepeatDiscountSettings();
  const dates = occurrenceDates(
    start,
    end,
    recurrence,
    recurrence !== "none" ? repeatCount : 1
  );
  await assertAvailable(offering.facilityId, offering.capacity, dates, id);

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
      amount: bookingAmount(
        price.amount,
        start,
        end,
        recurrence,
        !offering.endTime,
        repeatDiscount,
        repeatPaymentMode,
        repeatCount,
        customerDiscountPercent
      ),
      startDate: start,
      endDate: end,
      recurrence,
      repeatCount: recurrence !== "none" ? repeatCount : 1,
      requirementSetId: offering.requirementSetId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, id));

  await db.delete(bookingOccurrences).where(eq(bookingOccurrences.bookingId, id));
  await db.insert(bookingOccurrences).values(
    dates.map((date) => ({
      bookingId: id,
      facilityId: offering.facilityId,
      startDate: date.startDate,
      endDate: date.endDate,
      status: "confirmed" as const,
    }))
  );

  await logAudit({ action: "update", entity: "booking", entityId: id, description: "Updated booking" });
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}/edit`);
  revalidatePath("/booking");
}

export async function cancelAdminBooking(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("bookingId") || "");
  // Stop billing first: a subscription booking left running in Stripe would keep
  // charging the customer's card even after we mark it cancelled here.
  const [booking] = await db
    .select({ paymentType: bookings.paymentType, stripeSubscriptionId: bookings.stripeSubscriptionId })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);
  if (booking?.paymentType === "subscription" && booking.stripeSubscriptionId) {
    await getStripe().subscriptions.cancel(booking.stripeSubscriptionId);
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
  await logAudit({ action: "delete", entity: "booking", entityId: id, description: "Cancelled booking" });
  revalidatePath("/admin/bookings");
  revalidatePath("/booking");
}
