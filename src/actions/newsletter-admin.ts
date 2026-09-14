"use server";

import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "editor")) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getNewsletterSubscribers() {
  await requireAdmin();
  return db
    .select()
    .from(newsletterSubscribers)
    .orderBy(desc(newsletterSubscribers.createdAt));
}

// Someone who asked in person or by email to be added to the list.
export async function addNewsletterSubscriber(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
  await db
    .insert(newsletterSubscribers)
    .values({ email })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: { status: "active" },
      setWhere: sql`${newsletterSubscribers.status} = 'unsubscribed'`,
    });
  await logAudit({
    action: "create",
    entity: "newsletter",
    description: `Added newsletter subscriber ${email}`,
  });
  revalidatePath("/admin/newsletter");
}

export async function setNewsletterSubscriberStatus(
  id: string,
  status: "active" | "unsubscribed"
) {
  await requireAdmin();
  const [row] = await db
    .update(newsletterSubscribers)
    .set({ status })
    .where(eq(newsletterSubscribers.id, id))
    .returning({ email: newsletterSubscribers.email });
  if (!row) throw new Error("Subscriber not found.");
  await logAudit({
    action: "update",
    entity: "newsletter",
    entityId: id,
    description: `${status === "active" ? "Reactivated" : "Unsubscribed"} newsletter subscriber ${row.email}`,
  });
  revalidatePath("/admin/newsletter");
}

// Removes the address entirely -- for a GDPR erasure request, as opposed to an
// unsubscribe, which keeps the row so a re-signup does not re-add someone who
// opted out.
export async function deleteNewsletterSubscriber(id: string) {
  await requireAdmin();
  const [row] = await db
    .delete(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, id))
    .returning({ email: newsletterSubscribers.email });
  if (!row) throw new Error("Subscriber not found.");
  await logAudit({
    action: "delete",
    entity: "newsletter",
    entityId: id,
    description: `Deleted newsletter subscriber ${row.email}`,
  });
  revalidatePath("/admin/newsletter");
}
