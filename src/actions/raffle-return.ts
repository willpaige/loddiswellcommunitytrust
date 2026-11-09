"use server";

import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lotteryPayments, raffleDraws, raffleOrders, raffles } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/raffles/auth";
import { computeRaffleReturn, LOTTERY_LIMITS } from "@/lib/raffles/limits";
import { formatPence } from "@/lib/raffles/numbers";

/** The figures for one raffle's council return. */
export async function getRaffleReturn(raffleId: string) {
  await requireStaff();
  const [raffle] = await db.select().from(raffles).where(eq(raffles.id, raffleId)).limit(1);
  if (!raffle) return null;
  const orders = await db
    .select()
    .from(raffleOrders)
    .where(and(eq(raffleOrders.raffleId, raffleId), inArray(raffleOrders.status, ["paid", "refunded"])));

  // The £250,000 limit covers every lottery the Trust runs in the calendar
  // year, the monthly lottery included.
  const year = raffle.drawAt.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const [[rafflesYear], [lotteryYear]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${raffleOrders.amount} - ${raffleOrders.refundedAmount}), 0)::int` })
      .from(raffleOrders)
      .where(and(inArray(raffleOrders.status, ["paid", "refunded"]), gte(raffleOrders.paidAt, start), lt(raffleOrders.paidAt, end))),
    db
      .select({ total: sql<number>`coalesce(sum(${lotteryPayments.amount} - ${lotteryPayments.refundedAmount}), 0)::int` })
      .from(lotteryPayments)
      .where(and(gte(lotteryPayments.paidAt, start), lt(lotteryPayments.paidAt, end))),
  ]);

  const figures = computeRaffleReturn({
    prizes: raffle.prizes,
    drawAt: raffle.drawAt,
    otherExpensesPence: raffle.otherExpensesPence,
    orders,
    yearProceeds: Number(rafflesYear?.total ?? 0) + Number(lotteryYear?.total ?? 0),
  });
  return { raffle, figures };
}

export async function saveRaffleOtherExpenses(raffleId: string, formData: FormData) {
  await requireStaff();
  const pounds = Number(String(formData.get("otherExpenses") ?? "0").replace(/[£,\s]/g, ""));
  if (!Number.isFinite(pounds) || pounds < 0) throw new Error("Enter an amount in pounds.");
  const pence = Math.round(pounds * 100);
  await db.update(raffles).set({ otherExpensesPence: pence, updatedAt: new Date() }).where(eq(raffles.id, raffleId));
  await logAudit({ action: "update", entity: "raffle", entityId: raffleId, description: `Set other expenses to ${formatPence(pence)}` });
  revalidatePath(`/admin/raffles/${raffleId}/return`);
}

export async function setRaffleReturnSubmitted(raffleId: string, submitted: boolean) {
  await requireStaff();
  await db.update(raffles).set({ returnSubmittedAt: submitted ? new Date() : null, updatedAt: new Date() }).where(eq(raffles.id, raffleId));
  await logAudit({ action: "update", entity: "raffle", entityId: raffleId, description: submitted ? "Marked the council return as submitted" : "Marked the council return as not submitted" });
  revalidatePath(`/admin/raffles/${raffleId}/return`);
  revalidatePath("/admin");
}

/** Drawn raffles whose return isn't submitted and is due within four weeks (or overdue). */
export async function getDueRaffleReturns(now = new Date()) {
  await requireStaff();
  const rows = await db
    .select({ id: raffles.id, title: raffles.title, drawAt: raffles.drawAt })
    .from(raffles)
    .innerJoin(raffleDraws, eq(raffleDraws.raffleId, raffles.id))
    .where(and(isNull(raffles.returnSubmittedAt), isNotNull(raffleDraws.drawnAt)));
  const soon = now.getTime() + 28 * 24 * 60 * 60 * 1000;
  return rows
    .map((r) => {
      const due = new Date(r.drawAt);
      due.setUTCMonth(due.getUTCMonth() + LOTTERY_LIMITS.returnDueMonths);
      return { ...r, dueBy: due, overdue: due.getTime() < now.getTime() };
    })
    .filter((r) => r.dueBy.getTime() <= soon)
    .sort((a, b) => a.dueBy.getTime() - b.dueBy.getTime());
}
