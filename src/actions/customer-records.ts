"use server";

import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function upsertCustomerRecord({
  email,
  name,
  phone,
}: {
  email: string;
  name?: string | null;
  phone?: string | null;
}) {
  const normalisedEmail = email.trim().toLowerCase();
  if (!normalisedEmail) return null;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalisedEmail))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({
        name: name?.trim() || existing.name,
        phone: phone?.trim() || existing.phone,
      })
      .where(eq(users.id, existing.id));
    return existing.id;
  }

  const id = createId();
  await db.insert(users).values({
    id,
    email: normalisedEmail,
    name: name?.trim() || null,
    phone: phone?.trim() || null,
    role: "customer",
  });
  return id;
}
