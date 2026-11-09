"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { raffleDraws, raffleOrders, raffleTickets, raffles } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/raffles/auth";
import { DrawError, ordinal, redrawPrize, runDraw, sendDrawEmails, type DrawEmailSummary } from "@/lib/raffles/draw";
import { formatTicket } from "@/lib/raffles/numbers";

export type DrawActionResult = { error: string | null; summary?: DrawEmailSummary };

async function slugOf(raffleId: string) {
  const [row] = await db.select({ slug: raffles.slug }).from(raffles).where(eq(raffles.id, raffleId)).limit(1);
  return row?.slug ?? null;
}

async function revalidate(raffleId: string) {
  const slug = await slugOf(raffleId);
  revalidatePath(`/admin/raffles/${raffleId}`);
  revalidatePath(`/admin/raffles/${raffleId}/draw`);
  revalidatePath("/raffles");
  if (slug) revalidatePath(`/raffles/${slug}`);
}

function message(error: unknown) {
  if (error instanceof DrawError) return error.message;
  console.error("Raffle draw error:", error);
  return "Something went wrong. Nothing has been changed.";
}

export async function startRaffleDraw(input: {
  raffleId: string;
  method: "system" | "physical";
  onePerPerson: boolean;
  prizeOrder: number[];
  physicalNumbers?: number[];
}): Promise<DrawActionResult> {
  const session = await requireStaff();
  try {
    const draw = await runDraw({ ...input, drawnBy: session.user?.id ?? null });
    await logAudit({
      action: "create",
      entity: "raffle",
      entityId: input.raffleId,
      description: `Ran the ${input.method} draw: ${draw.results.map((r) => `${ordinal(r.rank)} ${formatTicket(r.ticketNumber)}`).join(", ")}`,
      metadata: { drawId: draw.id, poolSize: draw.poolSize, poolChecksum: draw.poolChecksum },
    });
    await revalidate(input.raffleId);
    return { error: null };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function redrawRafflePrize(raffleId: string, rank: number, reason: string): Promise<DrawActionResult> {
  const session = await requireStaff();
  try {
    const by = session.user?.email ?? session.user?.id ?? "admin";
    const { draw, replaced, winner } = await redrawPrize({ raffleId, rank, reason, by });
    await logAudit({
      action: "update",
      entity: "raffle",
      entityId: raffleId,
      description: `Redrew ${ordinal(rank)} prize: ${formatTicket(replaced)} → ${formatTicket(winner.ticketNumber)} (${reason.trim()})`,
      metadata: { drawId: draw.id },
    });
    // Results already out: tell the new winner only. Everyone else's email
    // is already logged as sent, so nothing else goes.
    const summary = draw.publishedAt ? await sendDrawEmails(raffleId, { onlyWinners: true }) : undefined;
    await revalidate(raffleId);
    return { error: null, summary };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function setPrizeCollected(raffleId: string, rank: number, collected: boolean) {
  await requireStaff();
  const [draw] = await db.select().from(raffleDraws).where(eq(raffleDraws.raffleId, raffleId)).limit(1);
  if (!draw) throw new Error("Not drawn");
  const results = draw.results.map((r) => (r.rank === rank ? { ...r, collectedAt: collected ? new Date().toISOString() : null } : r));
  await db.update(raffleDraws).set({ results }).where(eq(raffleDraws.id, draw.id));
  await logAudit({ action: "update", entity: "raffle", entityId: raffleId, description: `${ordinal(rank)} prize marked ${collected ? "collected" : "not collected"}` });
  await revalidate(raffleId);
}

/** Puts the results on the website and sends every result email. */
export async function publishRaffleResults(raffleId: string): Promise<DrawActionResult> {
  await requireStaff();
  const [draw] = await db.select().from(raffleDraws).where(eq(raffleDraws.raffleId, raffleId)).limit(1);
  if (!draw) return { error: "This raffle hasn't been drawn." };
  try {
    if (!draw.publishedAt) {
      await db.update(raffleDraws).set({ publishedAt: new Date() }).where(eq(raffleDraws.id, draw.id));
    }
    const summary = await sendDrawEmails(raffleId);
    if (!draw.notifiedAt) await db.update(raffleDraws).set({ notifiedAt: new Date() }).where(eq(raffleDraws.id, draw.id));
    await logAudit({
      action: "publish",
      entity: "raffle",
      entityId: raffleId,
      description: `Published results: ${summary.winnerEmails} winner and ${summary.resultsEmails} results emails, ${summary.failed} failed, ${summary.noEmail.length} entrants without email`,
      metadata: { drawId: draw.id },
    });
    await revalidate(raffleId);
    return { error: null, summary };
  } catch (error) {
    return { error: message(error) };
  }
}

/** Sends again to anyone whose email failed. Already-sent addresses are skipped. */
export async function retryRaffleDrawEmails(raffleId: string): Promise<DrawActionResult> {
  await requireStaff();
  const [draw] = await db.select().from(raffleDraws).where(and(eq(raffleDraws.raffleId, raffleId), isNotNull(raffleDraws.publishedAt))).limit(1);
  if (!draw) return { error: "Publish the results first." };
  try {
    const summary = await sendDrawEmails(raffleId);
    await logAudit({ action: "update", entity: "raffle", entityId: raffleId, description: `Retried result emails: ${summary.failed} still failing` });
    await revalidate(raffleId);
    return { error: null, summary };
  } catch (error) {
    return { error: message(error) };
  }
}

export type TicketCheck = { status: "won"; prize: string; rank: number } | { status: "lost" } | { status: "unknown" };

/** Public "check your ticket", only once results are published. */
export async function checkRaffleTicket(raffleId: string, raw: string): Promise<TicketCheck> {
  const n = Number(String(raw).replace(/[#\s]/g, ""));
  if (!Number.isInteger(n) || n < 1) return { status: "unknown" };
  const [draw] = await db
    .select({ results: raffleDraws.results })
    .from(raffleDraws)
    .where(and(eq(raffleDraws.raffleId, raffleId), isNotNull(raffleDraws.publishedAt)))
    .limit(1);
  if (!draw) return { status: "unknown" };
  const win = draw.results.find((r) => r.ticketNumber === n);
  if (win) return { status: "won", prize: win.prizeTitle, rank: win.rank };
  const [ticket] = await db
    .select({ id: raffleTickets.id })
    .from(raffleTickets)
    .innerJoin(raffleOrders, eq(raffleOrders.id, raffleTickets.orderId))
    .where(and(eq(raffleTickets.raffleId, raffleId), eq(raffleTickets.ticketNumber, n), eq(raffleTickets.void, false), eq(raffleOrders.status, "paid")))
    .limit(1);
  return ticket ? { status: "lost" } : { status: "unknown" };
}
