"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lotteryTicketNumbers, lotteryTickets } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type TicketHolder = {
  id: string;
  ticketNumber: number;
  holderName: string | null;
};

export type TicketHolderInput = {
  id: string;
  holderName: string;
};

const MAX_NAME_LENGTH = 100;

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/** Active ticket numbers for a set of tickets, grouped by ticket id. */
export async function getTicketHoldersForTickets(ticketIds: string[]) {
  const grouped = new Map<string, TicketHolder[]>();
  if (ticketIds.length === 0) return grouped;

  const rows = await db
    .select({
      id: lotteryTicketNumbers.id,
      ticketId: lotteryTicketNumbers.ticketId,
      ticketNumber: lotteryTicketNumbers.ticketNumber,
      holderName: lotteryTicketNumbers.holderName,
    })
    .from(lotteryTicketNumbers)
    .where(
      and(
        inArray(lotteryTicketNumbers.ticketId, ticketIds),
        eq(lotteryTicketNumbers.active, true)
      )
    )
    .orderBy(asc(lotteryTicketNumbers.ticketNumber));

  for (const row of rows) {
    const list = grouped.get(row.ticketId) ?? [];
    list.push({
      id: row.id,
      ticketNumber: row.ticketNumber,
      holderName: row.holderName,
    });
    grouped.set(row.ticketId, list);
  }
  return grouped;
}

export async function getTicketHolders(ticketId: string): Promise<TicketHolder[]> {
  const grouped = await getTicketHoldersForTickets([ticketId]);
  return grouped.get(ticketId) ?? [];
}

async function saveHolders(ticketId: string, input: TicketHolderInput[]) {
  if (!Array.isArray(input)) throw new Error("Invalid holder list");

  const existing = await db
    .select({ id: lotteryTicketNumbers.id })
    .from(lotteryTicketNumbers)
    .where(
      and(
        eq(lotteryTicketNumbers.ticketId, ticketId),
        eq(lotteryTicketNumbers.active, true)
      )
    );
  const allowed = new Set(existing.map((row) => row.id));

  for (const item of input) {
    if (!item || typeof item.id !== "string" || !allowed.has(item.id)) {
      throw new Error("Ticket number does not belong to this subscription");
    }
  }

  for (const item of input) {
    await db
      .update(lotteryTicketNumbers)
      .set({ holderName: cleanName(item.holderName) })
      .where(eq(lotteryTicketNumbers.id, item.id));
  }

  revalidatePath("/admin/lottery");
  revalidatePath("/account/lottery");
}

export async function adminUpdateTicketHolders(
  ticketId: string,
  holders: TicketHolderInput[]
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await saveHolders(ticketId, holders);
  await logAudit({
    action: "update",
    entity: "lottery",
    entityId: ticketId,
    description: "Updated ticket holder names",
  });
}

export async function customerUpdateTicketHolders(
  ticketId: string,
  holders: TicketHolderInput[]
) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Please sign in to update ticket holders");

  const [ticket] = await db
    .select({ id: lotteryTickets.id, email: lotteryTickets.email })
    .from(lotteryTickets)
    .where(eq(lotteryTickets.id, ticketId))
    .limit(1);
  if (!ticket || ticket.email.toLowerCase() !== session.user.email.toLowerCase()) {
    throw new Error("Lottery entry not found");
  }

  await saveHolders(ticketId, holders);
}
