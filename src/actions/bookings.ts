"use server";

import { addDays, addHours, differenceInHours, format } from "date-fns";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lt, lte, ne, or, sql } from "drizzle-orm";
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
  bookingOccurrences,
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
  BOOKING_HORIZON_DAYS,
  occurrenceDates,
  occurrenceDatesInWindow,
  toWatermarkDate,
} from "@/lib/booking-recurrence";
import {
  capacityUnitNoun,
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

// Shared with the seed scripts so both generate identical occurrence dates.
const SUBSCRIPTION_HORIZON_DAYS = BOOKING_HORIZON_DAYS;

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
  // Blocks are no longer an absolute veto — a partial block just claims some of
  // the capacity, so we need every overlapping block, not just the first.
  const [overlappingBlocks, overlappingOccurrences] = await Promise.all([
    db
      .select({
        startDate: bookingBlocks.startDate,
        endDate: bookingBlocks.endDate,
        capacity: bookingBlocks.capacity,
      })
      .from(bookingBlocks)
      .where(
        and(
          eq(bookingBlocks.facilityId, facilityId),
          lt(bookingBlocks.startDate, range.endDate),
          gt(bookingBlocks.endDate, range.startDate)
        )
      ),
    db
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
      ),
  ]);

  // excludeBookingId only ever applied to occurrences — blocks have no bookingId.
  return hasCapacity(
    range,
    toCapacityUse(overlappingBlocks, overlappingOccurrences, capacity),
    capacity
  );
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
    .map((row) => `${format(row.startDate, "d MMM yyyy, HH:mm")}–${format(row.endDate, "HH:mm")}`)
    .join("; ");
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
      startDate: format(booking.startDate, "d MMM yyyy, HH:mm"),
      endTime: format(booking.endDate, "HH:mm"),
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
                ? `${recurrenceLabel(booking.recurrence)} session, billed ${recurrenceLabel(billingInterval).toLowerCase()}, from ${format(booking.startDate, "d MMM yyyy")}`
                : schedule || format(booking.startDate, "d MMM yyyy, HH:mm"),
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
    description: `${booking.facilityName} - ${booking.offeringName || "Booking"} · ${schedule || format(booking.startDate, "d MMM yyyy, HH:mm")}`,
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
      .select({ maxStart: sql<string | null>`max(${bookingOccurrences.startDate})` })
      .from(bookingOccurrences)
      .where(
        and(eq(bookingOccurrences.bookingId, sub.id), ne(bookingOccurrences.status, "cancelled"))
      );

    const candidates = occurrenceDatesInWindow(
      sub.startDate,
      sub.endDate,
      sub.recurrence,
      toWatermarkDate(maxStart),
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

export async function extendRecurringBookingBlocks() {
  const now = new Date();
  const horizonEnd = addDays(now, SUBSCRIPTION_HORIZON_DAYS);
  const series = await db.select().from(bookingBlockSeries).where(eq(bookingBlockSeries.indefinite, true));
  let created = 0;
  for (const item of series) {
    const [{ maxStart }] = await db
      .select({ maxStart: sql<string | null>`max(${bookingBlocks.startDate})` })
      .from(bookingBlocks)
      .where(eq(bookingBlocks.seriesId, item.id));
    const ranges = occurrenceDatesInWindow(
      item.startDate,
      item.endDate,
      item.recurrence,
      toWatermarkDate(maxStart),
      horizonEnd
      // Without a watermark (every block of the series deleted) the generator
      // replays from the immutable anchor, so drop anything already in the past
      // rather than resurrecting a year of historical block-outs.
    ).filter((range) => range.startDate >= now);
    if (ranges.length > 0) {
      await db.insert(bookingBlocks).values(ranges.map((range) => ({
        facilityId: item.facilityId,
        seriesId: item.id,
        title: item.title,
        startDate: range.startDate,
        endDate: range.endDate,
        capacity: item.capacity,
        notes: item.notes,
        createdBy: item.createdBy,
      })))
      // Belt and braces alongside the watermark: the partial unique index makes
      // a repeated run a no-op even if the watermark is ever wrong again.
      // Untargeted because Postgres will not match a targeted ON CONFLICT to a
      // partial index without repeating its predicate.
      .onConflictDoNothing();
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
    // Free units per (start, end) pair, so the "last one left" hint reflects the
    // duration actually chosen. Keyed the same way as endTimesByStart and only
    // populated for end times that survived the availability filter, so it costs
    // the same order of payload.
    remainingByRange: Record<string, Record<string, number>>;
  }> = [];
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(0, 0, 0, 0);
  const rangeEnd = addDays(tomorrow, 180);

  const [blocks, occurrences] = await Promise.all([
    db
      .select({
        startDate: bookingBlocks.startDate,
        endDate: bookingBlocks.endDate,
        capacity: bookingBlocks.capacity,
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

  // Built once: the inner loop below runs ~180 days x ~15 starts x ~15 ends, so
  // merging and sorting the facility's whole 180-day history inside it would be
  // ruinous. We narrow to the day in question before each sweep instead.
  const usage = toCapacityUse(blocks, occurrences, offering.capacity);

  for (let index = 0; index < 180; index += 1) {
    const day = addDays(tomorrow, index);
    if (!offering.allowedDays.includes(day.getDay())) continue;

    const dayEnd = addDays(day, 1);
    const dayUsage = usage.filter((item) => item.startDate < dayEnd && item.endDate > day);
    const rangeRemaining = (range: { startDate: Date; endDate: Date }) =>
      remainingCapacity(range, dayUsage, offering.capacity);

    const startTimes = offering.startTime
      ? [offering.startTime]
      : bookingHourRange(
          offering.bookableStartTime,
          offering.bookableEndTime,
          offering.durationMinutes
        );

    const availableTimes: string[] = [];
    const endTimesByStart: Record<string, string[]> = {};
    const remainingByRange: Record<string, Record<string, number>> = {};
    for (const time of startTimes) {
      const startDate = combineDateAndTime(format(day, "yyyy-MM-dd"), time);
      const endTimes = offering.endTime
        ? [offering.endTime]
        : bookingEndTimeRange(time, offering.bookableEndTime, offering.durationMinutes);

      const remainingByEnd: Record<string, number> = {};
      endTimesByStart[time] = endTimes.filter((endTime) => {
        const endDate = combineDateAndTime(format(day, "yyyy-MM-dd"), endTime);
        const remaining = rangeRemaining({ startDate, endDate });
        if (remaining > 0) remainingByEnd[endTime] = remaining;
        return remaining > 0;
      });

      if (endTimesByStart[time].length > 0) {
        availableTimes.push(time);
        remainingByRange[time] = remainingByEnd;
      }
    }

    if (availableTimes.length > 0) {
      slots.push({
        date: format(day, "yyyy-MM-dd"),
        times: availableTimes,
        endTimesByStart,
        remainingByRange,
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

// A weighted claim on a facility's capacity for a time range. A booking claims
// one unit; a block claims however many units it was created for, and a
// whole-facility block (capacity NULL) claims all of them.
type CapacityUse = { startDate: Date; endDate: Date; units?: number };

// Lowest number of free units anywhere inside `range`. Occupancy is
// piecewise-constant — it can only change at the range start or at an interior
// start/end of an overlapping item — so sweeping those points is exact. Any
// item overlapping the range is guaranteed to be sampled: if it starts at or
// before range.startDate it covers that point, otherwise its own start is
// interior. Can go negative if a facility is already over-subscribed.
function remainingCapacity(
  range: { startDate: Date; endDate: Date },
  existing: CapacityUse[],
  capacity: number
) {
  const boundaries = existing
    .flatMap((item) => [item.startDate, item.endDate])
    .filter((date) => date > range.startDate && date < range.endDate)
    .sort((a, b) => a.getTime() - b.getTime());
  const checks = [range.startDate, ...boundaries];

  return checks.reduce((lowest, point) => {
    const used = existing.reduce(
      (total, item) =>
        item.startDate <= point && item.endDate > point ? total + (item.units ?? 1) : total,
      0
    );
    return Math.min(lowest, capacity - used);
  }, capacity);
}

function hasCapacity(
  range: { startDate: Date; endDate: Date },
  existing: CapacityUse[],
  capacity: number
) {
  return remainingCapacity(range, existing, capacity) > 0;
}

// Highest number of units in use at any instant. Same boundary sweep as
// remainingCapacity, but without a fixed range or a known ceiling — used to
// decide whether a proposed capacity is large enough for what is already booked.
function peakUsage(existing: CapacityUse[]) {
  return existing.reduce((highest, item) => {
    const used = existing.reduce(
      (total, other) =>
        other.startDate <= item.startDate && other.endDate > item.startDate
          ? total + (other.units ?? 1)
          : total,
      0
    );
    return Math.max(highest, used);
  }, 0);
}

// Blocks are stored per facility but capacity is defined per offering, so clamp:
// a block can never claim more units than the offering being tested against has.
// This also makes an over-large block degrade to "whole facility" rather than
// producing a nonsense negative remainder.
function toCapacityUse(
  blocks: Array<{ startDate: Date; endDate: Date; capacity: number | null }>,
  occurrences: Array<{ startDate: Date; endDate: Date }>,
  capacity: number
): CapacityUse[] {
  return [
    ...blocks.map((block) => ({
      startDate: block.startDate,
      endDate: block.endDate,
      units: Math.min(block.capacity ?? capacity, capacity),
    })),
    ...occurrences.map((item) => ({
      startDate: item.startDate,
      endDate: item.endDate,
      units: 1,
    })),
  ];
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
  let repeatPaymentMode: "subscription" | "upfront" =
    recurrence !== "none" && formData.get("repeatPaymentMode") === "upfront"
      ? "upfront"
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
  const submittedDiscountCode = String(formData.get("discountCode") || "").trim();
  const codeResult = submittedDiscountCode
    ? await validateBookingDiscountCode(submittedDiscountCode, customerEmail)
    : null;
  if (codeResult && !codeResult.valid) throw new Error(codeResult.message);
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
      : recurrence !== "none" && repeatPaymentMode === "subscription"
        ? "subscription"
        : "one_off",
    amount,
    discountCodeId: codeResult?.id ?? null,
    discountCode: codeResult?.code ?? null,
    discountPercent: appliedDiscountPercent,
    discountAmount: Math.max(0, undiscountedAmount - amount),
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
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      invoiceStatus: bookings.invoiceStatus,
      amount: bookings.amount,
      customerName: bookings.customerName,
      organisationName: bookings.organisationName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      recurrence: bookings.recurrence,
      scheduleType: bookings.scheduleType,
      repeatCount: bookings.repeatCount,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .orderBy(desc(bookings.startDate));
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
  // setup.offerings is active-only (it comes from the public feed and also
  // drives the manual booking dialog), so the settings screen needs its own
  // unfiltered list — otherwise deactivating an offering hides the very row you
  // would use to switch it back on.
  const [setup, cancellationSettings, blocks, offeringSettings] = await Promise.all([
    getPublicBookingData(),
    getCancellationSettings(),
    db
    .select({
      id: bookingBlocks.id,
      seriesId: bookingBlocks.seriesId,
      title: bookingBlocks.title,
      startDate: bookingBlocks.startDate,
      endDate: bookingBlocks.endDate,
      capacity: bookingBlocks.capacity,
      facilityName: facilities.name,
      facilitySlug: facilities.slug,
      recurrence: bookingBlockSeries.recurrence,
      indefinite: bookingBlockSeries.indefinite,
      repeatCount: bookingBlockSeries.repeatCount,
    })
    .from(bookingBlocks)
    .innerJoin(facilities, eq(bookingBlocks.facilityId, facilities.id))
    .leftJoin(bookingBlockSeries, eq(bookingBlocks.seriesId, bookingBlockSeries.id))
    .orderBy(desc(bookingBlocks.startDate)),
    db
      .select({
        offeringId: bookingOfferings.id,
        offeringName: bookingOfferings.name,
        facilityId: facilities.id,
        facilityName: facilities.name,
        facilitySlug: facilities.slug,
        capacity: bookingOfferings.capacity,
        active: bookingOfferings.active,
        facilityBookableStartTime: facilities.bookableStartTime,
        facilityBookableEndTime: facilities.bookableEndTime,
        // Left-joined so an offering with no prices yet still gets a row, and so
        // the settings screen never has to fall back to the active-only feed for
        // prices — doing so showed £0.00 for deactivated offerings, one Save away
        // from overwriting the real ones.
        customerGroup: bookingPrices.customerGroup,
        amount: bookingPrices.amount,
      })
      .from(bookingOfferings)
      .innerJoin(facilities, eq(bookingOfferings.facilityId, facilities.id))
      .leftJoin(bookingPrices, eq(bookingPrices.offeringId, bookingOfferings.id))
      .where(inArray(facilities.slug, publicFacilitySlugs))
      .orderBy(facilities.sortOrder, bookingOfferings.sortOrder, asc(bookingOfferings.name)),
  ]);
  return { ...setup, cancellationSettings, blocks, offeringSettings };
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
        capacity: bookingBlocks.capacity,
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
      capacity: block.capacity,
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

// Returns form state rather than throwing: a rejected capacity change is an
// expected outcome the admin needs to read, and Next.js redacts thrown
// server-action messages in production builds.
export type BookingOfferingFormState = { error?: string; saved?: boolean };

export async function updateBookingOffering(
  _prevState: BookingOfferingFormState,
  formData: FormData
): Promise<BookingOfferingFormState> {
  await requireAdmin();
  const offeringId = String(formData.get("offeringId") || "");
  const capacityRaw = String(formData.get("capacity") || "").trim();
  const capacity = Math.round(Number(capacityRaw));
  const active = formData.get("active") === "on";
  if (!offeringId) return { error: "Booking type not found." };
  if (capacityRaw === "" || !Number.isFinite(capacity) || capacity < 1 || capacity > 50) {
    return { error: "Capacity must be a whole number between 1 and 50." };
  }

  const [offering] = await db
    .select({
      id: bookingOfferings.id,
      name: bookingOfferings.name,
      facilityId: bookingOfferings.facilityId,
      facilitySlug: facilities.slug,
      capacity: bookingOfferings.capacity,
    })
    .from(bookingOfferings)
    .innerJoin(facilities, eq(bookingOfferings.facilityId, facilities.id))
    .where(eq(bookingOfferings.id, offeringId))
    .limit(1);
  if (!offering) return { error: "Booking type not found." };

  // Lowering capacity below what is already committed would leave existing
  // customers double-booked, so refuse rather than silently over-subscribe.
  if (capacity < offering.capacity) {
    const [future, partialBlocks] = await Promise.all([
      db
        .select({ startDate: bookingOccurrences.startDate, endDate: bookingOccurrences.endDate })
        .from(bookingOccurrences)
        .where(
          and(
            eq(bookingOccurrences.facilityId, offering.facilityId),
            ne(bookingOccurrences.status, "cancelled"),
            gte(bookingOccurrences.endDate, new Date())
          )
        ),
      // Only blocks with an explicit size compete for capacity here. A
      // whole-facility block (capacity NULL) scales with whatever the offering
      // is set to, so it can never be the thing that makes a reduction unsafe.
      db
        .select({
          startDate: bookingBlocks.startDate,
          endDate: bookingBlocks.endDate,
          capacity: bookingBlocks.capacity,
        })
        .from(bookingBlocks)
        .where(
          and(
            eq(bookingBlocks.facilityId, offering.facilityId),
            isNotNull(bookingBlocks.capacity),
            gte(bookingBlocks.endDate, new Date())
          )
        ),
    ]);

    const committed: CapacityUse[] = [
      ...future.map((item) => ({ ...item, units: 1 })),
      ...partialBlocks.map((block) => ({
        startDate: block.startDate,
        endDate: block.endDate,
        units: block.capacity ?? 1,
      })),
    ];
    const peak = peakUsage(committed);
    if (peak > capacity) {
      return {
        error: `Capacity cannot be lowered to ${capacity}: up to ${peak} ${capacityUnitNoun(offering.facilitySlug, peak)} are already committed at this venue by existing bookings or held block-outs.`,
      };
    }
  }

  await db
    .update(bookingOfferings)
    .set({ capacity, active, updatedAt: new Date() })
    .where(eq(bookingOfferings.id, offeringId));

  await logAudit({
    action: "update",
    entity: "booking",
    entityId: offeringId,
    description: `Updated booking type: ${offering.name} (capacity ${capacity}, ${active ? "active" : "inactive"})`,
  });
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/bookings/settings");
  revalidatePath("/admin/bookings/availability");
  revalidatePath("/booking");
  return { saved: true };
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
  // How many units of the venue's capacity this closes. Anything missing or
  // unparseable means the whole facility, which is what single-capacity venues
  // always post since the form omits the control for them.
  const capacityValue = Math.round(Number(String(formData.get("capacity") || "").trim()));
  const capacity = Number.isFinite(capacityValue) && capacityValue > 0 ? capacityValue : null;
  const createdBy = session.user?.id ?? null;

  if (!recurrence) {
    await db
      .insert(bookingBlocks)
      .values({ facilityId, title, startDate, endDate, capacity, notes, createdBy });
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
      capacity,
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
      capacity,
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
  const indefinite =
    scheduleType === "regular" && recurrence !== "none" &&
    (isSubscription || (!requiresPayment && formData.get("indefinite") === "on"));
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
    paymentType: isSubscription ? "subscription" : sendPaymentLink ? "one_off" : "manual",
    billingInterval: isSubscription ? billingInterval : null,
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
      allocatedAmount: customAmounts?.allocations[index] ?? 0,
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
  const [currentBooking] = await db
    .select({ scheduleType: bookings.scheduleType })
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
  if (currentBooking.scheduleType !== "custom") {
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

  if (currentBooking.scheduleType === "custom") {
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
    await logAudit({ action: "update", entity: "booking", entityId: id, description: "Updated custom booking details" });
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
  const shouldRefund = formData.get("refund") === "true";
  // Stop billing first: a subscription booking left running in Stripe would keep
  // charging the customer's card even after we mark it cancelled here.
  const [booking] = await db
    .select({
      paymentType: bookings.paymentType,
      status: bookings.status,
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
    await getStripe().refunds.create(
      { payment_intent: booking.stripePaymentIntentId },
      { idempotencyKey: `admin-booking-refund-${id}` }
    );
  }
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
      await getStripe().refunds.create(
        { payment_intent: row.stripePaymentIntentId, amount: row.occurrence.allocatedAmount },
        { idempotencyKey: `booking-occurrence-refund-${occurrenceId}` }
      );
      refundStatus = "refunded";
      refundedAt = new Date();
      refundedBy = session.user?.id ?? null;
    } else if (row.invoiceStatus === "paid") {
      refundStatus = "due";
    }
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
      amount: Math.max(0, row.amount - row.occurrence.allocatedAmount),
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
  await logAudit({
    action: "delete",
    entity: "booking",
    entityId: row.bookingId,
    description: `Cancelled booking session on ${format(row.occurrence.startDate, "d MMM yyyy, HH:mm")}`,
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
