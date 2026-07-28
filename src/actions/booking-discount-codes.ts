"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { bookingDiscountCodes, bookings } from "@/lib/db/schema";

export type DiscountCodeResult = {
  valid: boolean;
  code?: string;
  id?: string;
  discountPercent?: number;
  message: string;
};

function normaliseCode(value: string) {
  return value.trim().toUpperCase();
}

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "editor")) throw new Error("Unauthorized");
  return session;
}

function optionalPositiveInteger(value: FormDataEntryValue | null) {
  if (!value || !String(value).trim()) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error("Usage limits must be positive whole numbers.");
  return number;
}

function optionalDate(value: FormDataEntryValue | null, endOfDay = false) {
  if (!value || !String(value).trim()) return null;
  const date = new Date(`${String(value)}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date.");
  return date;
}

export async function validateBookingDiscountCode(
  rawCode: string,
  customerEmail?: string
): Promise<DiscountCodeResult> {
  const code = normaliseCode(rawCode);
  if (!code) return { valid: false, message: "Enter a discount code." };
  const [record] = await db
    .select()
    .from(bookingDiscountCodes)
    .where(eq(bookingDiscountCodes.code, code))
    .limit(1);
  const now = new Date();
  if (!record || !record.active) return { valid: false, message: "This discount code is not valid." };
  if (record.validFrom && record.validFrom > now) return { valid: false, message: "This discount code is not active yet." };
  if (record.validUntil && record.validUntil < now) return { valid: false, message: "This discount code has expired." };

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(eq(bookings.discountCodeId, record.id));
  if (record.maxRedemptions && count >= record.maxRedemptions) {
    return { valid: false, message: "This discount code has reached its usage limit." };
  }
  if (record.maxRedemptionsPerCustomer && customerEmail?.trim()) {
    const [{ count: customerCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(
        eq(bookings.discountCodeId, record.id),
        eq(bookings.customerEmail, customerEmail.trim().toLowerCase())
      ));
    if (customerCount >= record.maxRedemptionsPerCustomer) {
      return { valid: false, message: "You have already used this discount code the maximum number of times." };
    }
  }
  return {
    valid: true,
    code: record.code,
    id: record.id,
    discountPercent: record.discountPercent,
    message: `${record.discountPercent}% discount code applied.`,
  };
}

export async function getBookingDiscountCodes() {
  await requireAdmin();
  return db
    .select({
      id: bookingDiscountCodes.id,
      code: bookingDiscountCodes.code,
      description: bookingDiscountCodes.description,
      discountPercent: bookingDiscountCodes.discountPercent,
      validFrom: bookingDiscountCodes.validFrom,
      validUntil: bookingDiscountCodes.validUntil,
      maxRedemptions: bookingDiscountCodes.maxRedemptions,
      maxRedemptionsPerCustomer: bookingDiscountCodes.maxRedemptionsPerCustomer,
      active: bookingDiscountCodes.active,
      redemptions: sql<number>`count(${bookings.id})::int`,
    })
    .from(bookingDiscountCodes)
    .leftJoin(bookings, eq(bookings.discountCodeId, bookingDiscountCodes.id))
    .groupBy(bookingDiscountCodes.id)
    .orderBy(asc(bookingDiscountCodes.code));
}

function readCodeForm(formData: FormData) {
  const code = normaliseCode(String(formData.get("code") || ""));
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error("Codes must be 3–32 letters, numbers, hyphens, or underscores.");
  const discountPercent = Number(formData.get("discountPercent"));
  if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    throw new Error("Discount must be a whole percentage between 1 and 100.");
  }
  const validFrom = optionalDate(formData.get("validFrom"));
  const validUntil = optionalDate(formData.get("validUntil"), true);
  if (validFrom && validUntil && validUntil < validFrom) throw new Error("End date must be after start date.");
  return {
    code,
    description: String(formData.get("description") || "").trim() || null,
    discountPercent,
    validFrom,
    validUntil,
    maxRedemptions: optionalPositiveInteger(formData.get("maxRedemptions")),
    maxRedemptionsPerCustomer: optionalPositiveInteger(formData.get("maxRedemptionsPerCustomer")),
    active: formData.get("active") === "on",
    updatedAt: new Date(),
  };
}

export async function createBookingDiscountCode(formData: FormData) {
  const session = await requireAdmin();
  const values = readCodeForm(formData);
  const [existing] = await db.select({ id: bookingDiscountCodes.id }).from(bookingDiscountCodes)
    .where(eq(bookingDiscountCodes.code, values.code)).limit(1);
  if (existing) throw new Error("A discount code with this name already exists.");
  await db.insert(bookingDiscountCodes).values({
    ...values,
    createdBy: (session.user as { id?: string }).id ?? null,
  });
  await logAudit({ action: "create", entity: "booking", description: `Created discount code ${values.code}` });
  revalidatePath("/admin/bookings/discount-codes");
}

export async function updateBookingDiscountCode(id: string, formData: FormData) {
  await requireAdmin();
  const values = readCodeForm(formData);
  await db.update(bookingDiscountCodes).set(values).where(eq(bookingDiscountCodes.id, id));
  await logAudit({ action: "update", entity: "booking", entityId: id, description: `Updated discount code ${values.code}` });
  revalidatePath("/admin/bookings/discount-codes");
}
