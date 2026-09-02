"use server";

import { createId } from "@paralleldrive/cuid2";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { lotteryTicketNumbers, lotteryTickets } from "@/lib/db/schema";

export async function ensureLotteryTicketNumbers(ticketId: string) {
  const [ticket] = await db
    .select()
    .from(lotteryTickets)
    .where(eq(lotteryTickets.id, ticketId))
    .limit(1);
  if (!ticket) return [];

  const existing = await db
    .select()
    .from(lotteryTicketNumbers)
    .where(eq(lotteryTicketNumbers.ticketId, ticket.id))
    .orderBy(lotteryTicketNumbers.ticketNumber);

  const activeExisting = existing.filter((row) => row.active);
  if (activeExisting.length > ticket.quantity) {
    const toDeactivate = activeExisting.slice(ticket.quantity);
    for (const row of toDeactivate) {
      await db
        .update(lotteryTicketNumbers)
        .set({ active: false })
        .where(eq(lotteryTicketNumbers.id, row.id));
    }
  }

  if (activeExisting.length < ticket.quantity) {
    const [{ maxNumber }] = await db
      .select({ maxNumber: sql<number>`coalesce(max(${lotteryTicketNumbers.ticketNumber}), 0)` })
      .from(lotteryTicketNumbers);
    const values = Array.from({ length: ticket.quantity - activeExisting.length }, (_, index) => ({
      id: createId(),
      ticketId: ticket.id,
      ticketNumber: Number(maxNumber) + index + 1,
      email: ticket.email,
      name: ticket.name,
      active: true,
    }));
    await db.insert(lotteryTicketNumbers).values(values);
  }

  // Keep payer name/email in sync. holderName is deliberately untouched so
  // per-number holder assignments survive webhooks, imports and draws.
  await db
    .update(lotteryTicketNumbers)
    .set({ email: ticket.email, name: ticket.name })
    .where(eq(lotteryTicketNumbers.ticketId, ticket.id));

  return db
    .select()
    .from(lotteryTicketNumbers)
    .where(eq(lotteryTicketNumbers.ticketId, ticket.id))
    .orderBy(lotteryTicketNumbers.ticketNumber);
}

export async function ticketNumbersText(ticketId: string) {
  const numbers = await ensureLotteryTicketNumbers(ticketId);
  return numbers
    .filter((row) => row.active)
    .map((row) => row.ticketNumber)
    .join(", ");
}

export async function ensureAllLotteryTicketNumbers() {
  const rows = await db
    .select({ id: lotteryTickets.id })
    .from(lotteryTickets)
    .orderBy(desc(lotteryTickets.createdAt));
  for (const row of rows) {
    await ensureLotteryTicketNumbers(row.id);
  }
}
