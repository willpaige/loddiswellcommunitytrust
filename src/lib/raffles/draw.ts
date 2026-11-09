import { createHash } from "node:crypto";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  raffleDraws,
  raffleOrders,
  raffleTickets,
  raffles,
  siteSettings,
  users,
  type RaffleDrawResult,
} from "@/lib/db/schema";
import { pickWinners } from "@/lib/draw/random";
import { sendBulkTemplateEmails, type BulkEmail } from "@/lib/email/bulk-send";
import { compressRanges, formatPence, formatTicket } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";
import { addDays } from "date-fns";
import { unsubscribeUrl } from "@/lib/raffles/unsubscribe";

// The draw. Winners are picked on the server and saved before anything is
// shown, so the reveal screen only ever plays back a recorded result.

export type PoolEntry = { ticketNumber: number; orderId: string; holder: string; name: string };

/** Who a ticket belongs to, for one prize per person: email, else phone, else order. */
function holderOf(order: { id: string; email: string | null; phone: string | null }) {
  if (order.email) return `email:${order.email.toLowerCase()}`;
  if (order.phone) return `phone:${order.phone.replace(/\s+/g, "")}`;
  return `order:${order.id}`;
}

/** "Jo Smith" → "Jo S." for anything shown in public. */
export function publicName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Every valid ticket: not void, on a paid order. */
export async function loadPool(raffleId: string): Promise<PoolEntry[]> {
  const rows = await db
    .select({
      ticketNumber: raffleTickets.ticketNumber,
      orderId: raffleOrders.id,
      email: raffleOrders.email,
      phone: raffleOrders.phone,
      name: raffleOrders.name,
    })
    .from(raffleTickets)
    .innerJoin(raffleOrders, eq(raffleOrders.id, raffleTickets.orderId))
    .where(and(eq(raffleTickets.raffleId, raffleId), eq(raffleTickets.void, false), eq(raffleOrders.status, "paid")))
    .orderBy(asc(raffleTickets.ticketNumber));
  return rows.map((r) => ({
    ticketNumber: r.ticketNumber,
    orderId: r.orderId,
    holder: holderOf({ id: r.orderId, email: r.email, phone: r.phone }),
    name: r.name,
  }));
}

export function poolChecksum(numbers: number[]) {
  return createHash("sha256").update([...numbers].sort((a, b) => a - b).join(",")).digest("hex");
}

export type DrawReadiness = {
  salesClosed: boolean;
  checkoutsInProgress: number;
  poolSize: number;
  entrants: number;
  cashOrders: number;
  cashTickets: number;
  voidTickets: number;
  prizes: number;
  ready: boolean;
};

export async function drawReadiness(raffleId: string, now = new Date()): Promise<DrawReadiness> {
  const [raffle] = await db.select().from(raffles).where(eq(raffles.id, raffleId)).limit(1);
  if (!raffle) throw new Error("Raffle not found");
  const [pool, inProgress, cash, voided] = await Promise.all([
    loadPool(raffleId),
    db
      .select({ id: raffleOrders.id })
      .from(raffleOrders)
      .where(and(eq(raffleOrders.raffleId, raffleId), eq(raffleOrders.status, "pending"), gt(raffleOrders.expiresAt, now))),
    db
      .select({ quantity: raffleOrders.quantity })
      .from(raffleOrders)
      .where(and(eq(raffleOrders.raffleId, raffleId), eq(raffleOrders.status, "paid"), eq(raffleOrders.source, "manual"))),
    db.select({ id: raffleTickets.id }).from(raffleTickets).where(and(eq(raffleTickets.raffleId, raffleId), eq(raffleTickets.void, true))),
  ]);
  const salesClosed = now >= raffle.salesCloseAt;
  return {
    salesClosed,
    checkoutsInProgress: inProgress.length,
    poolSize: pool.length,
    entrants: new Set(pool.map((p) => p.holder)).size,
    cashOrders: cash.length,
    cashTickets: cash.reduce((s, o) => s + o.quantity, 0),
    voidTickets: voided.length,
    prizes: raffle.prizes.length,
    ready: salesClosed && inProgress.length === 0 && pool.length > 0 && raffle.prizes.length > 0 && !raffle.cancelledAt,
  };
}

export type RunDrawInput = {
  raffleId: string;
  method: "system" | "physical";
  onePerPerson: boolean;
  /** Prize ranks in the order they are drawn, e.g. [3, 2, 1] for suspense. */
  prizeOrder: number[];
  /** For a physical draw: the number pulled for each prize, in prizeOrder. */
  physicalNumbers?: number[];
  drawnBy: string | null;
  now?: Date;
};

export class DrawError extends Error {}

export async function runDraw(input: RunDrawInput) {
  const now = input.now ?? new Date();
  const [raffle] = await db.select().from(raffles).where(eq(raffles.id, input.raffleId)).limit(1);
  if (!raffle) throw new DrawError("Raffle not found.");
  const [existing] = await db.select({ id: raffleDraws.id }).from(raffleDraws).where(eq(raffleDraws.raffleId, raffle.id)).limit(1);
  if (existing) throw new DrawError("This raffle has already been drawn.");

  const readiness = await drawReadiness(raffle.id, now);
  if (raffle.cancelledAt) throw new DrawError("This raffle has been cancelled.");
  if (!readiness.salesClosed) throw new DrawError("Sales haven't closed yet. Close sales first.");
  if (readiness.checkoutsInProgress > 0)
    throw new DrawError(`${readiness.checkoutsInProgress} checkout(s) are still in progress. Wait for them to finish or expire (at most 30 minutes).`);
  if (readiness.poolSize === 0) throw new DrawError("There are no tickets to draw from.");

  const ranks = raffle.prizes.map((p) => p.rank);
  const order = input.prizeOrder;
  if (order.length !== ranks.length || new Set(order).size !== order.length || !order.every((r) => ranks.includes(r)))
    throw new DrawError("The prize order doesn't match this raffle's prizes.");

  const pool = await loadPool(raffle.id);
  const byNumber = new Map(pool.map((p) => [p.ticketNumber, p]));
  let winners: PoolEntry[];

  if (input.method === "physical") {
    const numbers = input.physicalNumbers ?? [];
    if (numbers.length !== order.length) throw new DrawError("Enter a ticket number for every prize.");
    if (new Set(numbers).size !== numbers.length) throw new DrawError("The same ticket number is entered twice.");
    winners = numbers.map((n) => {
      const entry = byNumber.get(n);
      if (!entry) throw new DrawError(`${formatTicket(n)} isn't a valid ticket in this raffle.`);
      return entry;
    });
    if (input.onePerPerson && new Set(winners.map((w) => w.holder)).size !== winners.length)
      throw new DrawError("One person has more than one winning number, but each person can only win once.");
  } else {
    winners = pickWinners(pool, order.length, input.onePerPerson ? { holderKey: (e) => e.holder } : {});
  }

  const prizeByRank = new Map(raffle.prizes.map((p) => [p.rank, p]));
  // If there are fewer eligible entrants than prizes, the leftover prizes
  // simply aren't won; they are dropped from the results.
  const results: RaffleDrawResult[] = winners.map((w, i) => ({
    rank: order[i],
    prizeTitle: prizeByRank.get(order[i])!.title,
    ticketNumber: w.ticketNumber,
    orderId: w.orderId,
    collectedAt: null,
    history: [],
  }));

  const numbers = pool.map((p) => p.ticketNumber);
  // The unique index on raffle_id means two admins pressing Draw at once
  // produce one draw; the loser's insert fails.
  const [draw] = await db
    .insert(raffleDraws)
    .values({
      raffleId: raffle.id,
      method: input.method,
      onePerPerson: input.onePerPerson,
      poolSize: numbers.length,
      poolChecksum: poolChecksum(numbers),
      poolSnapshot: numbers,
      results,
      drawnAt: now,
      drawnBy: input.drawnBy,
    })
    .onConflictDoNothing({ target: raffleDraws.raffleId })
    .returning();
  if (!draw) throw new DrawError("This raffle has already been drawn.");
  return draw;
}

/**
 * Replaces one prize's winner (under 18, no reply, declined…). Picks from the
 * frozen pool, never live data, and skips every ticket that has won or been
 * replaced, and every person who has been replaced. With one prize per person,
 * it also skips everyone who already holds a prize.
 */
export async function redrawPrize({ raffleId, rank, reason, by, now = new Date() }: {
  raffleId: string; rank: number; reason: string; by: string; now?: Date;
}) {
  if (!reason.trim()) throw new DrawError("Give a reason for the redraw.");
  const [draw] = await db.select().from(raffleDraws).where(eq(raffleDraws.raffleId, raffleId)).limit(1);
  if (!draw) throw new DrawError("This raffle hasn't been drawn.");
  const target = draw.results.find((r) => r.rank === rank);
  if (!target) throw new DrawError("That prize isn't in the results.");
  if (target.collectedAt) throw new DrawError("That prize has already been collected.");

  const pool = (await loadPool(raffleId)).filter((p) => draw.poolSnapshot.includes(p.ticketNumber));
  const byNumber = new Map(pool.map((p) => [p.ticketNumber, p]));
  const usedNumbers = new Set(draw.results.flatMap((r) => [r.ticketNumber, ...r.history.map((h) => h.ticketNumber)]));
  // Anyone replaced before (under 18, declined…) is out as a person, not just
  // that one ticket, so their other tickets can't win this prize back.
  const replacedHolders = draw.results
    .flatMap((r) => [...r.history.map((h) => h.ticketNumber), ...(r.rank === rank ? [r.ticketNumber] : [])])
    .map((n) => byNumber.get(n)?.holder)
    .filter((h): h is string => !!h);
  const winningHolders = draw.onePerPerson
    ? draw.results.map((r) => byNumber.get(r.ticketNumber)?.holder).filter((h): h is string => !!h)
    : [];
  const excludeHolders = [...winningHolders, ...replacedHolders];
  const excluded = new Set(excludeHolders);
  const [winner] = pickWinners(pool, 1, {
    exclude: (e) => usedNumbers.has(e.ticketNumber) || excluded.has(e.holder),
  });
  if (!winner) throw new DrawError("There's nobody left in the draw to give this prize to.");

  const results = draw.results.map((r) =>
    r.rank === rank
      ? {
          ...r,
          ticketNumber: winner.ticketNumber,
          orderId: winner.orderId,
          history: [...r.history, { ticketNumber: r.ticketNumber, reason: reason.trim(), by, at: now.toISOString() }],
        }
      : r
  );
  await db.update(raffleDraws).set({ results }).where(eq(raffleDraws.id, draw.id));
  return { draw: { ...draw, results }, replaced: target.ticketNumber, winner };
}

// ── Result emails ──

export type DrawEmailSummary = {
  winnerEmails: number;
  resultsEmails: number;
  managerEmail: number;
  failed: number;
  skipped: number;
  noEmail: { name: string; phone: string | null; prize: string | null }[];
};

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * Winners get raffle_winner instead of the general email; every other
 * address gets one raffle_results listing its own numbers; the Trust's inbox
 * gets the summary. Every email is keyed in the email log, so running this
 * again (Retry failed, or after a redraw) only sends what hasn't gone yet.
 */
export async function sendDrawEmails(raffleId: string, { onlyWinners = false }: { onlyWinners?: boolean } = {}): Promise<DrawEmailSummary> {
  const [raffle] = await db.select().from(raffles).where(eq(raffles.id, raffleId)).limit(1);
  const [draw] = await db.select().from(raffleDraws).where(eq(raffleDraws.raffleId, raffleId)).limit(1);
  if (!raffle || !draw) throw new DrawError("This raffle hasn't been drawn.");

  const orders = await db
    .select()
    .from(raffleOrders)
    .where(and(eq(raffleOrders.raffleId, raffleId), eq(raffleOrders.status, "paid")));
  const tickets = await db
    .select({ orderId: raffleTickets.orderId, n: raffleTickets.ticketNumber })
    .from(raffleTickets)
    .where(and(eq(raffleTickets.raffleId, raffleId), eq(raffleTickets.void, false)));
  const numbersByOrder = new Map<string, number[]>();
  for (const t of tickets) numbersByOrder.set(t.orderId, [...(numbersByOrder.get(t.orderId) ?? []), t.n]);
  const orderById = new Map(orders.map((o) => [o.id, o]));

  const cause = raffle.causeTitle || "Loddiswell's community facilities";
  const drawDate = formatUk(raffle.drawAt, "EEEE d MMMM");
  const resultsUrl = `${appUrl()}/raffles/${raffle.slug}`;
  const raised = orders.reduce((s, o) => s + o.amount - o.refundedAmount, 0);
  const sorted = [...draw.results].sort((a, b) => a.rank - b.rank);
  const winnersText = sorted
    .map((r) => `${ordinal(r.rank)} · ${r.prizeTitle} · ${formatTicket(r.ticketNumber)} · ${publicName(orderById.get(r.orderId)?.name ?? "")}`)
    .join("\n");

  // Addresses grouped so each person gets one email with all their numbers.
  const byEmail = new Map<string, { name: string; numbers: number[]; optOut: boolean }>();
  for (const o of orders) {
    if (!o.email) continue;
    const key = o.email.toLowerCase();
    const entry = byEmail.get(key) ?? { name: o.name, numbers: [], optOut: false };
    entry.numbers.push(...(numbersByOrder.get(o.id) ?? []));
    entry.optOut = entry.optOut || o.marketingOptOut;
    byEmail.set(key, entry);
  }

  const emails: BulkEmail[] = [];
  const winnerAddresses = new Set<string>();
  for (const r of sorted) {
    const order = orderById.get(r.orderId);
    if (!order?.email) continue;
    const address = order.email.toLowerCase();
    winnerAddresses.add(address);
    const others = (byEmail.get(address)?.numbers ?? []).filter((n) => n !== r.ticketNumber);
    emails.push({
      key: "raffle_winner",
      to: address,
      relatedEntityId: `${draw.id}:winner:${r.rank}:${r.ticketNumber}`,
      variables: {
        name: order.name.split(" ")[0],
        ticketNumber: formatTicket(r.ticketNumber),
        prizeRank: ordinal(r.rank),
        prizeName: r.prizeTitle,
        raffleTitle: raffle.title,
        drawDate,
        claimInstructions: raffle.claimInstructions || "Reply to this email and we'll arrange for you to collect your prize.",
        claimBy: formatUk(addDays(draw.publishedAt ?? new Date(), raffle.claimDays), "EEEE d MMMM"),
        ageNotice: raffle.minAge >= 18 ? "This prize contains alcohol, so please bring photo ID showing you are 18 or over." : "",
        otherTickets: others.length ? `Your other tickets in this draw: ${compressRanges(others)}` : "",
        cause,
      },
    });
  }

  let nextRaffleText = "";
  if (!onlyWinners) {
    const [next] = await db
      .select()
      .from(raffles)
      .where(and(eq(raffles.published, true), gt(raffles.salesCloseAt, new Date())))
      .orderBy(asc(raffles.salesOpenAt))
      .limit(2);
    if (next && next.id !== raffle.id) {
      nextRaffleText = `Next up: ${next.title}. Tickets on sale ${formatUk(next.salesOpenAt, "EEEE d MMMM")}. ${appUrl()}/raffles/${next.slug}`;
    }
    for (const [address, entry] of byEmail) {
      if (winnerAddresses.has(address)) continue;
      emails.push({
        key: "raffle_results",
        to: address,
        relatedEntityId: `${draw.id}:results:${address}`,
        variables: {
          name: entry.name.split(" ")[0],
          raffleTitle: raffle.title,
          drawDate,
          yourTickets: compressRanges(entry.numbers),
          winners: winnersText,
          totalRaised: formatPence(raised),
          cause,
          resultsUrl,
          nextRaffle: entry.optOut || !nextRaffleText ? "" : `${nextRaffleText}\nDon't want raffle news? ${unsubscribeUrl(address)}`,
        },
      });
    }
  }

  const noEmail = orders
    .filter((o) => !o.email)
    .map((o) => ({
      name: o.name,
      phone: o.phone,
      prize: sorted.find((r) => r.orderId === o.id)?.prizeTitle ?? null,
    }))
    .sort((a, b) => (a.prize ? 0 : 1) - (b.prize ? 0 : 1));

  const main = await sendBulkTemplateEmails(emails, "raffle_draw");

  let managerSent = 0;
  let managerFailed = 0;
  if (!onlyWinners) {
    const [settings] = await db.select({ emailAddress: siteSettings.emailAddress }).from(siteSettings).limit(1);
    const [drawer] = draw.drawnBy
      ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, draw.drawnBy)).limit(1)
      : [];
    const manager = await sendBulkTemplateEmails(
      [
        {
          key: "raffle_draw_manager",
          to: settings?.emailAddress || "hello@loddiswellcommunitytrust.org",
          relatedEntityId: `${draw.id}:manager`,
          variables: {
            raffleTitle: raffle.title,
            drawnAt: formatUk(draw.drawnAt, "EEE d MMM 'at' HH:mm"),
            drawnBy: drawer?.name || drawer?.email || "an admin",
            poolSize: draw.poolSize,
            winnersFull: sorted
              .map((r) => {
                const o = orderById.get(r.orderId);
                return `${ordinal(r.rank)} · ${r.prizeTitle} · ${formatTicket(r.ticketNumber)} · ${o?.name ?? "?"} · ${[o?.email, o?.phone].filter(Boolean).join(" · ") || "no contact details"}`;
              })
              .join("\n"),
            emailSummary: `${main.sent} sent, ${main.failed} failed, ${main.skipped} already sent or skipped`,
            noEmailList: noEmail.length
              ? noEmail.map((p) => `${p.prize ? `WINNER (${p.prize}): ` : ""}${p.name} · ${p.phone ?? "no phone"}`).join("\n")
              : "None",
            proceeds: formatPence(raised),
            adminUrl: `${appUrl()}/admin/raffles/${raffle.id}/draw`,
          },
        },
      ],
      "raffle_draw"
    );
    managerSent = manager.sent;
    managerFailed = manager.failed;
  }

  const winnerEmails = emails.filter((e) => e.key === "raffle_winner").length;
  return {
    winnerEmails,
    resultsEmails: emails.length - winnerEmails,
    managerEmail: managerSent,
    failed: main.failed + managerFailed,
    skipped: main.skipped,
    noEmail,
  };
}

/** Raffle ids whose winners' public names are needed, resolved in one query. */
export async function winnerNames(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, string>();
  const rows = await db.select({ id: raffleOrders.id, name: raffleOrders.name }).from(raffleOrders).where(inArray(raffleOrders.id, orderIds));
  return new Map(rows.map((r) => [r.id, publicName(r.name)]));
}
