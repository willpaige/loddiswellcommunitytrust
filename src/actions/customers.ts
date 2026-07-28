"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { bookings, lotteryTickets, users } from "@/lib/db/schema";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "editor")) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getAdminCustomers() {
  await requireAdmin();
  return db
    .select()
    .from(users)
    .orderBy(users.email);
}

export async function getAdminCustomer(id: string) {
  await requireAdmin();
  const [customer] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return customer ?? null;
}

export async function getCustomerDiscountByEmail(email: string) {
  await requireAdmin();
  const normalised = email.trim().toLowerCase();
  if (!normalised) return 0;
  const [customer] = await db
    .select({ discountPercent: users.discountPercent })
    .from(users)
    .where(eq(users.email, normalised))
    .limit(1);
  return Math.max(0, Math.min(100, customer?.discountPercent ?? 0));
}

export async function updateAdminCustomer(id: string, formData: FormData) {
  await requireAdmin();
  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing) throw new Error("Customer not found.");

  const name = String(formData.get("name") || "").trim() || null;
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim() || null;
  const role = String(formData.get("role") || "customer") as "admin" | "editor" | "customer";
  const discountPercent = Math.max(0, Math.min(100, Math.round(Number(formData.get("discountPercent")) || 0)));
  if (!email) throw new Error("Email is required.");
  if (!["admin", "editor", "customer"].includes(role)) throw new Error("Invalid role.");

  await db
    .update(users)
    .set({ name, email, phone, role, discountPercent })
    .where(eq(users.id, id));

  if (existing.email !== email) {
    await db.update(bookings).set({ customerEmail: email }).where(eq(bookings.customerEmail, existing.email));
    await db.update(lotteryTickets).set({ email }).where(eq(lotteryTickets.email, existing.email));
  }

  await logAudit({
    action: "update",
    entity: "user",
    entityId: id,
    description: `Updated customer ${email}`,
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}/edit`);
  redirect("/admin/customers");
}
