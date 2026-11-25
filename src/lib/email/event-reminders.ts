import { TZDate } from "@date-fns/tz";
import { and, eq, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { formatBookingDate } from "@/lib/booking-time";
import { db } from "@/lib/db";
import { emailLogs, events, newsletterSubscribers } from "@/lib/db/schema";
import type { EmailPromoCard } from "@/lib/email/layout";
import { sendTemplateEmail } from "@/lib/email/send";
import { rafflePromoForEmail } from "@/lib/raffles/promo";

function wallDate(uk: TZDate, daysAhead: number) {
  return new Date(Date.UTC(uk.getFullYear(), uk.getMonth(), uk.getDate() + daysAhead));
}

function describeEventTime(event: typeof events.$inferSelect) {
  const day = formatBookingDate(event.startDate, "EEEE d MMMM");
  if (event.allDay) return day;
  const start = `${day}, ${formatBookingDate(event.startDate, "h:mmaaa")}`;
  if (!event.endDate) return start;
  const sameDay = event.startDate.toISOString().slice(0, 10) === event.endDate.toISOString().slice(0, 10);
  return `${start} to ${formatBookingDate(event.endDate, sameDay ? "h:mmaaa" : "EEEE d MMMM, h:mmaaa")}`;
}

export async function sendEventReminders() {
  const now = new Date();
  const uk = new TZDate(now, "Europe/London");
  let sent = 0;
  let failed = 0;
  if (uk.getHours() < 10 || !process.env.POSTMARK_API_KEY) return { sent, failed };

  const midnight = new TZDate(uk.getFullYear(), uk.getMonth(), uk.getDate() + 1, "Europe/London");
  const deadline = Math.min(Date.now() + 240_000, midnight.getTime());
  const tomorrow = wallDate(uk, 1);
  const weekAhead = wallDate(uk, 7);
  const dayBeforeReminder = and(
    isNull(events.reminderSentAt),
    gte(events.startDate, tomorrow),
    lt(events.startDate, wallDate(uk, 2)),
  );
  const weekBeforeReminder = and(
    isNull(events.weekReminderSentAt),
    gte(events.startDate, weekAhead),
    lt(events.startDate, wallDate(uk, 8)),
  );
  const eligible = and(
    eq(events.published, true),
    eq(events.reminderEnabled, true),
    or(isNull(events.reminderClaimedAt), lt(events.reminderClaimedAt, new Date(now.getTime() - 360_000))),
    or(dayBeforeReminder, weekBeforeReminder),
  );
  const due = await db.select({ id: events.id }).from(events).where(eligible).orderBy(events.startDate);
  if (!due.length) return { sent, failed };

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org").replace(/\/$/, "");
  const raffle = await rafflePromoForEmail();

  for (const { id } of due) {
    if (Date.now() >= deadline) break;
    const claim = new Date();
    const [event] = await db.update(events).set({ reminderClaimedAt: claim })
      .where(and(eq(events.id, id), eligible)).returning();
    if (!event) continue;

    const isWeekReminder = event.startDate >= weekAhead;
    const key = isWeekReminder ? "event_week_reminder" : "event_reminder";
    let complete = true;
    try {
      const relatedEntityId = `${event.id}:${event.startDate.toISOString().slice(0, 10)}`;
      const recipientEmail = sql<string>`lower(trim(${newsletterSubscribers.email}))`;
      const [recipients, upcoming] = await Promise.all([
        db.select({ email: recipientEmail }).from(newsletterSubscribers).where(and(
          sql`${recipientEmail} <> ''`,
          sql`not exists (
            select 1 from ${emailLogs}
            where ${emailLogs.recipient} = ${recipientEmail}
              and ${emailLogs.templateKey} = ${key}
              and ${emailLogs.relatedEntityType} = 'event'
              and ${emailLogs.relatedEntityId} = ${relatedEntityId}
              and ${emailLogs.status} in ('sent', 'skipped')
          )`,
        )).groupBy(recipientEmail)
          .having(sql`bool_and(${newsletterSubscribers.status} = 'active')`)
          .orderBy(recipientEmail),
        db.select({ id: events.id, title: events.title, startDate: events.startDate })
          .from(events).where(and(eq(events.published, true), ne(events.id, id), gte(events.startDate, tomorrow)))
          .orderBy(events.startDate).limit(1),
      ]);

      const eventUrl = `${appUrl}/events#event-${id}`;
      const eventWhen = describeEventTime(event);
      const nextEvent = upcoming[0];
      const promoCards: Record<string, EmailPromoCard> = {
        lotteryPromo: {
          eyebrow: "Village lottery", title: "Join the village lottery",
          text: "Support Loddiswell’s playing fields and village hall.", url: `${appUrl}/lottery`,
        },
      };
      if (raffle.card) promoCards.rafflePromo = raffle.card;
      if (nextEvent) {
        promoCards.eventsPromo = {
          eyebrow: "Also coming up", title: nextEvent.title,
          text: formatBookingDate(nextEvent.startDate, "EEEE d MMMM"),
          url: `${appUrl}/events#event-${nextEvent.id}`,
        };
      }
      const promoText = (key: string) => {
        const card = promoCards[key];
        return card ? `${card.title}. ${card.text} ${card.url}` : "";
      };

      for (const { email } of recipients) {
        if (Date.now() >= deadline) {
          complete = false;
          break;
        }
        try {
          const result = await sendTemplateEmail({
            key,
            to: email,
            relatedEntityType: "event",
            relatedEntityId,
            variables: {
              eventTitle: event.title,
              eventWhen,
              eventLocation: event.location ? `\nWhere: ${event.location}` : "",
              eventUrl,
              rafflePromo: raffle.text,
              eventsPromo: promoText("eventsPromo"),
              lotteryPromo: promoText("lotteryPromo"),
            },
            extras: {
              preheader: [eventWhen, event.location].filter(Boolean).join(" · "),
              eyebrow: isWeekReminder ? "Happening in one week" : "Happening tomorrow",
              headline: event.title,
              cta: { label: "View event details", url: eventUrl },
              promoCards,
            },
          });
          if (result.sent) sent++;
          else if (result.reason === "disabled" || result.reason === "not_configured") {
            complete = false;
            break;
          }
        } catch {
          failed++;
          complete = false;
        }
      }
    } catch (error) {
      complete = false;
      failed++;
      console.error("Could not process event reminder", id, error);
    } finally {
      await db.update(events).set({
        reminderClaimedAt: null,
        ...(complete ? { [isWeekReminder ? "weekReminderSentAt" : "reminderSentAt"]: new Date() } : {}),
      }).where(and(eq(events.id, id), eq(events.reminderClaimedAt, claim)));
    }
  }

  return { sent, failed };
}
