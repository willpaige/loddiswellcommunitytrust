import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { TZDate } from "@date-fns/tz";
import { db } from "@/lib/db";
import { raffleInterest, raffleOrders, raffleTickets, raffles } from "@/lib/db/schema";
import { sendBulkTemplateEmails, type BulkEmail } from "@/lib/email/bulk-send";
import { compressRanges, formatPence, formatRaffleSerial } from "@/lib/raffles/numbers";
import { ticketsRemaining } from "@/lib/raffles/state";
import { ordinal } from "@/lib/raffles/draw";
import type { EmailExtras } from "@/lib/email/layout";
import { formatUk } from "@/lib/raffles/time";
import { releaseStaleRaffleOrders } from "@/lib/raffles/orders";
import { unsubscribeUrl } from "@/lib/raffles/unsubscribe";
import { getRaffleLaunchAudience } from "@/lib/raffles/audience";

// Run hourly by /api/cron/raffles. Each job stamps the raffle when it has
// run, and every email is deduped in the email log, so overlapping or
// repeated runs never send anything twice.

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

type Raffle = typeof raffles.$inferSelect;

/** The artwork, facts, prizes and button shared by the launch and follow-up emails. */
export function raffleMarketingExtras(raffle: Raffle, eyebrow: string, preheader: string): EmailExtras {
  const url = `${appUrl()}/raffles/${raffle.slug}`;
  const prizes = [...raffle.prizes].sort((a, b) => a.rank - b.rank);
  return {
    preheader,
    eyebrow: `Raffle ${formatRaffleSerial(raffle.serialNumber)} · ${eyebrow}`,
    headline: raffle.title,
    hero: raffle.heroImageUrl ? { src: raffle.heroImageUrl, alt: raffle.title, href: url } : undefined,
    facts: [
      { value: formatPence(raffle.ticketPricePence), label: "per ticket" },
      { value: formatUk(raffle.drawAt, "EEE d MMM"), label: `draw at ${formatUk(raffle.drawAt, "h:mmaaa")}` },
      { value: `${raffle.minAge}+`, label: "to enter" },
    ],
    cta: { label: "Buy tickets", url },
    prizes: prizes.map((p) => ({
      rank: ordinal(p.rank),
      title: p.title,
      description: [p.description, p.valuePence ? `Worth ${formatPence(p.valuePence)}.` : ""].filter(Boolean).join(" "),
    })),
    closing: raffle.causeTitle
      ? { strong: `Raising money for ${raffle.causeTitle}.`, text: "We'll email you the moment the winner is drawn." }
      : undefined,
  };
}

/**
 * When sales open: email everyone the Trust has an address for, apart from
 * anyone who has opted out (see getRaffleLaunchAudience). Each email has a
 * one-click unsubscribe link.
 */
export async function sendRaffleOnSaleEmails(now = new Date()) {
  const due = await db
    .select()
    .from(raffles)
    .where(
      and(
        eq(raffles.published, true),
        isNull(raffles.cancelledAt),
        isNull(raffles.openNotifiedAt),
        lte(raffles.salesOpenAt, now),
        gt(raffles.salesCloseAt, now)
      )
    );
  let sent = 0;
  for (const raffle of due) {
    // Stamp first: a second overlapping run then finds nothing to do.
    const [claimed] = await db
      .update(raffles)
      .set({ openNotifiedAt: now })
      .where(and(eq(raffles.id, raffle.id), isNull(raffles.openNotifiedAt)))
      .returning({ id: raffles.id });
    if (!claimed) continue;

    const interest = await db
      .select()
      .from(raffleInterest)
      .where(and(isNull(raffleInterest.notifiedAt), or(eq(raffleInterest.raffleId, raffle.id), isNull(raffleInterest.raffleId))));
    const addresses = await getRaffleLaunchAudience(raffle.id);

    const emails: BulkEmail[] = addresses.map((email) => ({
        key: "raffle_on_sale",
        to: email,
        relatedEntityId: `${raffle.id}:on_sale:${email}`,
        variables: {
          raffleTitle: raffle.title,
          price: formatPence(raffle.ticketPricePence),
          tagline: raffle.tagline ?? "",
          drawDate: formatUk(raffle.drawAt, "EEEE d MMMM"),
          raffleUrl: `${appUrl()}/raffles/${raffle.slug}`,
          unsubscribeUrl: unsubscribeUrl(email),
        },
        extras: raffleMarketingExtras(
          raffle,
          "Tickets on sale now",
          `${formatPence(raffle.ticketPricePence)} a ticket · Drawn ${formatUk(raffle.drawAt, "EEEE d MMMM")}`
        ),
      }));
    const result = await sendBulkTemplateEmails(emails, "raffle");
    sent += result.sent;
    if (interest.length) {
      await db.update(raffleInterest).set({ notifiedAt: now }).where(inArray(raffleInterest.id, interest.map((i) => i.id)));
    }
  }
  return sent;
}

const FOLLOW_UPS = [
  {
    key: "raffle_week_reminder" as const,
    column: "weekReminderSentAt" as const,
    daysBefore: 7,
    eyebrow: "One week left",
  },
  {
    key: "raffle_last_call" as const,
    column: "lastCallSentAt" as const,
    daysBefore: 1,
    eyebrow: "Last chance",
  },
];

/**
 * Follow-ups to the whole launch audience (everyone the Trust has an address
 * for, minus unsubscribes), from 10am UK a week before and the day before
 * ticket sales close. A follow-up only goes on its own day, so
 * a raffle that opened late never sends a "one week left" with three days to
 * go, and it is skipped when it would land within a day of the launch email.
 */
export async function sendRaffleFollowUps(now = new Date()) {
  const uk = new TZDate(now, "Europe/London");
  if (uk.getHours() < 10) return 0;
  const today = formatUk(now, "yyyy-MM-dd");
  const candidates = await db
    .select()
    .from(raffles)
    .where(and(eq(raffles.published, true), isNull(raffles.cancelledAt), gt(raffles.salesCloseAt, now)));

  let sent = 0;
  for (const raffle of candidates) {
    if (!raffle.openNotifiedAt || ticketsRemaining(raffle) === 0) continue;
    for (const f of FOLLOW_UPS) {
      if (raffle[f.column]) continue;
      const due = formatUk(new Date(raffle.salesCloseAt.getTime() - f.daysBefore * 86_400_000), "yyyy-MM-dd");
      if (due !== today) continue;
      if (now.getTime() - raffle.openNotifiedAt.getTime() < 86_400_000) continue;

      const [claimed] = await db
        .update(raffles)
        .set({ [f.column]: now })
        .where(and(eq(raffles.id, raffle.id), isNull(raffles[f.column])))
        .returning({ id: raffles.id });
      if (!claimed) continue;

      const addresses = await getRaffleLaunchAudience(raffle.id);

      const closeDate = formatUk(raffle.salesCloseAt, "EEEE d MMMM 'at' h:mmaaa");
      const emails: BulkEmail[] = addresses.map((email) => ({
        key: f.key,
        to: email,
        relatedEntityId: `${raffle.id}:${f.key}:${email}`,
        variables: {
          raffleTitle: raffle.title,
          price: formatPence(raffle.ticketPricePence),
          cause: raffle.causeTitle || "Loddiswell's community facilities",
          closeDate,
          drawDate: formatUk(raffle.drawAt, "EEEE d MMMM 'at' h:mmaaa"),
          raffleUrl: `${appUrl()}/raffles/${raffle.slug}`,
          unsubscribeUrl: unsubscribeUrl(email),
        },
        extras: raffleMarketingExtras(raffle, f.eyebrow, `Tickets close ${closeDate}`),
      }));
      const result = await sendBulkTemplateEmails(emails, "raffle");
      sent += result.sent;
    }
  }
  return sent;
}

/** The morning of the draw (from 9am UK): remind every entrant with an email. */
export async function sendRaffleDrawReminders(now = new Date()) {
  const uk = new TZDate(now, "Europe/London");
  if (uk.getHours() < 9) return 0;
  const candidates = await db
    .select()
    .from(raffles)
    .where(and(eq(raffles.published, true), isNull(raffles.cancelledAt), isNull(raffles.reminderSentAt), gt(raffles.drawAt, now)));
  const today = formatUk(now, "yyyy-MM-dd");
  let sent = 0;
  for (const raffle of candidates.filter((r) => formatUk(r.drawAt, "yyyy-MM-dd") === today)) {
    const [claimed] = await db
      .update(raffles)
      .set({ reminderSentAt: now })
      .where(and(eq(raffles.id, raffle.id), isNull(raffles.reminderSentAt)))
      .returning({ id: raffles.id });
    if (!claimed) continue;

    const orders = await db
      .select({ id: raffleOrders.id, email: raffleOrders.email, name: raffleOrders.name })
      .from(raffleOrders)
      .where(and(eq(raffleOrders.raffleId, raffle.id), eq(raffleOrders.status, "paid")));
    const tickets = await db
      .select({ orderId: raffleTickets.orderId, n: raffleTickets.ticketNumber })
      .from(raffleTickets)
      .where(and(eq(raffleTickets.raffleId, raffle.id), eq(raffleTickets.void, false)));
    const byEmail = new Map<string, { name: string; numbers: number[] }>();
    for (const o of orders) {
      if (!o.email) continue;
      const key = o.email.toLowerCase();
      const entry = byEmail.get(key) ?? { name: o.name, numbers: [] };
      entry.numbers.push(...tickets.filter((t) => t.orderId === o.id).map((t) => t.n));
      byEmail.set(key, entry);
    }
    const emails: BulkEmail[] = [...byEmail].map(([email, entry]) => ({
      key: "raffle_draw_reminder",
      to: email,
      relatedEntityId: `${raffle.id}:reminder:${email}`,
      variables: {
        name: entry.name.split(" ")[0],
        raffleTitle: raffle.title,
        drawTime: formatUk(raffle.drawAt, "h:mmaaa"),
        yourTickets: compressRanges(entry.numbers),
        liveStream: raffle.liveStreamUrl ? `Watch it live: ${raffle.liveStreamUrl}` : "",
        raffleUrl: `${appUrl()}/raffles/${raffle.slug}`,
      },
    }));
    const result = await sendBulkTemplateEmails(emails, "raffle");
    sent += result.sent;
  }
  return sent;
}

export async function runRaffleJobs(now = new Date()) {
  const released = await releaseStaleRaffleOrders(now);
  const onSale = await sendRaffleOnSaleEmails(now);
  const followUps = await sendRaffleFollowUps(now);
  const reminders = await sendRaffleDrawReminders(now);
  return { released, onSale, followUps, reminders };
}
