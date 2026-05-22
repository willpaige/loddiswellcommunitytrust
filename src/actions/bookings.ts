"use server";

import { addDays, addWeeks, differenceInHours, format } from "date-fns";
import { and, asc, desc, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import { ServerClient } from "postmark";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  bookingBlocks,
  bookingOccurrences,
  bookingOfferings,
  bookingPrices,
  bookings,
  facilities,
  users,
} from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import { customerGroups, type CustomerGroup, type Recurrence } from "@/lib/bookings";

const publicFacilitySlugs = ["village-hall", "pavilion", "tennis-courts"];

function getPostmark() {
  return new ServerClient(process.env.POSTMARK_API_KEY!);
}

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

function occurrenceDates(start: Date, end: Date, recurrence: Recurrence) {
  if (recurrence === "none") return [{ startDate: start, endDate: end }];
  return Array.from({ length: 26 }, (_, index) => ({
    startDate: addWeeks(start, index),
    endDate: addWeeks(end, index),
  }));
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
    "customerGroup",
    "recurrence",
    "customerName",
    "customerPhone",
    "notes",
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

async function sendBookingEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  if (!process.env.POSTMARK_API_KEY) return;
  await getPostmark().sendEmail({
    From: process.env.EMAIL_FROM || "noreply@loddiswellcommunitytrust.org",
    To: to,
    Subject: subject,
    TextBody: body,
  });
}

export async function ensureDefaultBookingSetup() {
  const existing = await db.select({ id: bookingOfferings.id }).from(bookingOfferings).limit(1);
  if (existing.length > 0) return;

  const facilityRows = await db
    .select()
    .from(facilities)
    .where(inArray(facilities.slug, publicFacilitySlugs));
  const bySlug = new Map(facilityRows.map((facility) => [facility.slug, facility]));

  const groups: CustomerGroup[] = ["resident", "parent_private", "team_community", "business"];
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
          group === "business"
            ? Math.round(seed.amount * 1.4)
            : group === "resident"
              ? Math.round(seed.amount * 0.8)
              : seed.amount,
      }))
    );
  }
}

export async function getPublicBookingData() {
  await ensureDefaultBookingSetup();
  const rows = await db
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
    .where(and(eq(bookingOfferings.active, true), inArray(facilities.slug, publicFacilitySlugs)))
    .orderBy(facilities.sortOrder, bookingOfferings.sortOrder, asc(bookingOfferings.name));

  return {
    customerGroups,
    offerings: rows,
  };
}

async function assertAvailable(facilityId: string, capacity: number, dates: Array<{ startDate: Date; endDate: Date }>) {
  for (const range of dates) {
    const overlappingOccurrences = await db
      .select({ id: bookingOccurrences.id })
      .from(bookingOccurrences)
      .where(
        and(
          eq(bookingOccurrences.facilityId, facilityId),
          ne(bookingOccurrences.status, "cancelled"),
          lt(bookingOccurrences.startDate, range.endDate),
          gt(bookingOccurrences.endDate, range.startDate)
        )
      )
      .limit(capacity);
    if (overlappingOccurrences.length >= capacity) {
      throw new Error("That time is no longer available.");
    }

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
    if (blockConflict.length > 0) throw new Error("That time is blocked by the Trust.");
  }
}

async function readBookingForm(formData: FormData) {
  const offeringId = String(formData.get("offeringId") || "");
  const customerGroup = String(formData.get("customerGroup") || "") as CustomerGroup;
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const recurrence: Recurrence = formData.get("recurrence") === "weekly" ? "weekly" : "none";

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
    : addMinutes(start, offering.durationMinutes);

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

  if (start < addDays(new Date(), 1)) {
    throw new Error("Bookings must be made at least 24 hours in advance.");
  }

  return { offering, price, start, end, recurrence };
}

export async function createBookingCheckout(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/account/login?callbackUrl=${encodeURIComponent(bookingCallbackUrl(formData))}`);
  }
  const customer = await ensureCustomerUser();
  const { offering, price, start, end, recurrence } = await readBookingForm(formData);
  const dates = occurrenceDates(start, end, recurrence);
  await assertAvailable(offering.facilityId, offering.capacity, dates);

  const facility = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, offering.facilityId))
    .limit(1);
  const customerName = String(formData.get("customerName") || customer.name || "").trim();
  const customerPhone = String(formData.get("customerPhone") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const customerEmail = customer.email.toLowerCase();
  if (!customerName) throw new Error("Name is required.");

  const bookingId = createId();
  const amount = recurrence === "weekly" ? price.amount * 4 : price.amount;
  await db.insert(bookings).values({
    id: bookingId,
    userId: customer.id,
    facilityId: offering.facilityId,
    offeringId: offering.id,
    customerGroup: price.customerGroup,
    customerName,
    customerEmail,
    customerPhone,
    notes,
    status: "pending_payment",
    paymentType: recurrence === "weekly" ? "subscription" : "one_off",
    amount,
    startDate: start,
    endDate: end,
    recurrence,
  });
  await db.insert(bookingOccurrences).values(
    dates.map((date) => ({
      bookingId,
      facilityId: offering.facilityId,
      startDate: date.startDate,
      endDate: date.endDate,
      status: "pending_payment" as const,
    }))
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: recurrence === "weekly" ? "subscription" : "payment",
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
              recurrence === "weekly"
                ? `Weekly booking billed monthly from ${format(start, "d MMM yyyy")}`
                : format(start, "d MMM yyyy, HH:mm"),
          },
          ...(recurrence === "weekly" ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    metadata: {
      type: "booking",
      bookingId,
    },
    subscription_data:
      recurrence === "weekly"
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

  if (booking.status !== "confirmed") {
    await db
      .update(bookings)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    await db
      .update(bookingOccurrences)
      .set({ status: "confirmed" })
      .where(eq(bookingOccurrences.bookingId, booking.id));
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

export async function cancelCustomerBooking(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const id = String(formData.get("bookingId") || "");
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking || booking.customerEmail !== session.user.email.toLowerCase()) {
    throw new Error("Booking not found.");
  }
  if (booking.status !== "confirmed") throw new Error("Only confirmed bookings can be cancelled.");
  if (differenceInHours(booking.startDate, new Date()) < 48) {
    throw new Error("Bookings can only be cancelled online at least 48 hours before the start time.");
  }

  if (booking.paymentType === "one_off" && booking.stripePaymentIntentId) {
    await getStripe().refunds.create({ payment_intent: booking.stripePaymentIntentId });
  }
  if (booking.paymentType === "subscription" && booking.stripeSubscriptionId) {
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

  await sendBookingEmail({
    to: booking.customerEmail,
    subject: "Your Loddiswell booking has been cancelled",
    body: `Your booking on ${format(booking.startDate, "d MMM yyyy, HH:mm")} has been cancelled. Eligible card payments have been refunded automatically.`,
  });

  revalidatePath("/account/bookings");
}

export async function getAdminBookings() {
  await requireAdmin();
  return db
    .select({
      id: bookings.id,
      status: bookings.status,
      paymentType: bookings.paymentType,
      amount: bookings.amount,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      startDate: bookings.startDate,
      endDate: bookings.endDate,
      recurrence: bookings.recurrence,
      facilityName: facilities.name,
      offeringName: bookingOfferings.name,
    })
    .from(bookings)
    .innerJoin(facilities, eq(bookings.facilityId, facilities.id))
    .leftJoin(bookingOfferings, eq(bookings.offeringId, bookingOfferings.id))
    .orderBy(desc(bookings.startDate));
}

export async function getAdminBookingSetup() {
  await requireAdmin();
  await ensureDefaultBookingSetup();
  const setup = await getPublicBookingData();
  const blocks = await db
    .select({
      id: bookingBlocks.id,
      title: bookingBlocks.title,
      startDate: bookingBlocks.startDate,
      endDate: bookingBlocks.endDate,
      facilityName: facilities.name,
    })
    .from(bookingBlocks)
    .innerJoin(facilities, eq(bookingBlocks.facilityId, facilities.id))
    .orderBy(desc(bookingBlocks.startDate));
  return { ...setup, blocks };
}

export async function getAdminAvailability() {
  await requireAdmin();
  const [bookingRows, blockRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        title: bookingOfferings.name,
        customerName: bookings.customerName,
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
      title: booking.title || booking.customerName,
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
      type: "block" as const,
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
  const { offering, price, start, end, recurrence } = await readBookingForm(formData);
  const dates = occurrenceDates(start, end, recurrence);
  await assertAvailable(offering.facilityId, offering.capacity, dates);

  const id = createId();
  await db.insert(bookings).values({
    id,
    facilityId: offering.facilityId,
    offeringId: offering.id,
    customerGroup: price.customerGroup,
    customerName: String(formData.get("customerName") || "").trim(),
    customerEmail: String(formData.get("customerEmail") || "").trim().toLowerCase(),
    customerPhone: String(formData.get("customerPhone") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    status: "confirmed",
    paymentType: "manual",
    amount: price.amount,
    startDate: start,
    endDate: end,
    recurrence,
  });
  await db.insert(bookingOccurrences).values(
    dates.map((date) => ({
      bookingId: id,
      facilityId: offering.facilityId,
      startDate: date.startDate,
      endDate: date.endDate,
      status: "confirmed" as const,
    }))
  );

  await logAudit({ action: "create", entity: "booking", entityId: id, description: "Created manual booking" });
  revalidatePath("/admin/bookings");
  revalidatePath("/booking");
}

export async function cancelAdminBooking(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("bookingId") || "");
  await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(bookings.id, id));
  await db
    .update(bookingOccurrences)
    .set({ status: "cancelled" })
    .where(eq(bookingOccurrences.bookingId, id));
  await logAudit({ action: "delete", entity: "booking", entityId: id, description: "Cancelled booking" });
  revalidatePath("/admin/bookings");
  revalidatePath("/booking");
}
