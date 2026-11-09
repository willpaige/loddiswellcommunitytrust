"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { raffleInterest, raffles } from "@/lib/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InterestState = { ok: boolean; message: string };

/**
 * "Remind me" from a coming-soon raffle, or "tell me about the next one"
 * (no raffle id). Idempotent: signing up twice is the same as once.
 */
export async function registerRaffleInterest(_prev: InterestState, formData: FormData): Promise<InterestState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const raffleIdRaw = String(formData.get("raffleId") ?? "").trim();
  // Honeypot: real visitors never fill this in.
  if (String(formData.get("company") ?? "")) return { ok: true, message: "Thanks! We'll let you know." };
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, message: "Please enter a valid email address." };

  let raffleId: string | null = null;
  if (raffleIdRaw) {
    const [raffle] = await db.select({ id: raffles.id }).from(raffles).where(and(eq(raffles.id, raffleIdRaw), eq(raffles.published, true))).limit(1);
    if (!raffle) return { ok: false, message: "That raffle isn't available." };
    raffleId = raffle.id;
  }

  // NULL raffle ids aren't covered by the unique index, so check first.
  const [existing] = await db
    .select({ id: raffleInterest.id })
    .from(raffleInterest)
    .where(and(raffleId ? eq(raffleInterest.raffleId, raffleId) : isNull(raffleInterest.raffleId), eq(raffleInterest.email, email), isNull(raffleInterest.notifiedAt)))
    .limit(1);
  if (!existing) {
    await db.insert(raffleInterest).values({ raffleId, email }).onConflictDoNothing();
  }
  return {
    ok: true,
    message: raffleId ? "Thanks! We'll email you when tickets go on sale." : "Thanks! We'll email you when the next raffle opens.",
  };
}
