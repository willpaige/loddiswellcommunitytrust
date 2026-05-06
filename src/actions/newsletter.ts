"use server";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeToNewsletter(formData: FormData) {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  try {
    await db
      .insert(newsletterSubscribers)
      .values({ email })
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        set: { status: "active" },
        setWhere: sql`${newsletterSubscribers.status} = 'unsubscribed'`,
      });

    return { success: true };
  } catch {
    return { error: "Something went wrong. Please try again." };
  }
}
