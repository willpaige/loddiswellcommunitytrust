import { cache } from "react";
import { differenceInCalendarDays } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { getPromotedRaffle } from "@/lib/raffles/public";
import { ticketsRemaining } from "@/lib/raffles/state";
import { formatPence } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";

// What the rest of the site says about the current raffle: the header strip,
// nav link, homepage and success-page cards, and {{rafflePromo}} in emails.

export type RafflePromo = {
  raffleId: string;
  slug: string;
  title: string;
  tagline: string | null;
  heroImageUrl: string | null;
  heroImageMobileUrl: string | null;
  causeTitle: string | null;
  state: "coming_soon" | "live" | "last_few" | "sold_out" | "closed";
  price: string;
  /** "Draw Mon 21 Dec". */
  drawLabel: string;
  /** The day of the draw, UK time, when the banner comes back once more. */
  drawDay: boolean;
  /** Banner colour: copper normally, red for the last few, green on draw day. */
  tone: "default" | "urgent" | "draw";
  minAge: number;
  liveStreamUrl: string | null;
  soldTickets: number;
  maxTickets: number | null;
  raisedPence: number;
  causeGoalPence: number | null;
  /** Short, urgent line: "6 days left", "Only 23 left", "Draw tonight 8pm". */
  label: string;
  cta: string;
  onSale: boolean;
};

function ukDay(date: Date) {
  return new TZDate(date, "Europe/London");
}

export const getRafflePromo = cache(async (): Promise<RafflePromo | null> => {
  let raffle;
  try {
    raffle = await getPromotedRaffle();
  } catch (error) {
    // A promo must never take a page or an email down with it.
    console.error("Could not load the promoted raffle", error);
    return null;
  }
  if (!raffle) return null;

  const now = new Date();
  const price = formatPence(raffle.ticketPricePence);
  const left = ticketsRemaining(raffle);
  const daysLeft = differenceInCalendarDays(ukDay(raffle.salesCloseAt), ukDay(now));
  let label: string;
  let cta = "Get tickets";
  switch (raffle.state) {
    case "coming_soon":
      label = `On sale ${formatUk(raffle.salesOpenAt, "EEE d MMM")}`;
      cta = "Take a look";
      break;
    case "last_few":
      label = left !== null && left <= 50 ? `Only ${left} left` : daysLeft <= 0 ? "Last chance: sales close today" : "Last few days";
      break;
    case "live":
      label = daysLeft <= 1 ? "Sales close tomorrow" : `${daysLeft} days left`;
      break;
    case "sold_out":
    case "closed": {
      const today = differenceInCalendarDays(ukDay(raffle.drawAt), ukDay(now)) === 0;
      label = today ? `Draw tonight ${formatUk(raffle.drawAt, "h:mmaaa")}` : `Draw ${formatUk(raffle.drawAt, "EEE d MMM")}`;
      cta = raffle.liveStreamUrl ? "Watch the draw" : "See the raffle";
      break;
    }
    default:
      return null;
  }

  const drawDay = differenceInCalendarDays(ukDay(raffle.drawAt), ukDay(now)) === 0;
  return {
    raffleId: raffle.id,
    slug: raffle.slug,
    title: raffle.title,
    tagline: raffle.tagline,
    heroImageUrl: raffle.heroImageUrl,
    heroImageMobileUrl: raffle.heroImageMobileUrl,
    causeTitle: raffle.causeTitle,
    state: raffle.state as RafflePromo["state"],
    price,
    drawLabel: `Draw ${formatUk(raffle.drawAt, "EEE d MMM")}`,
    drawDay,
    tone: drawDay ? "draw" : raffle.state === "last_few" ? "urgent" : "default",
    minAge: raffle.minAge,
    liveStreamUrl: raffle.liveStreamUrl,
    soldTickets: raffle.soldTickets,
    maxTickets: raffle.maxTickets,
    raisedPence: raffle.raisedPence,
    causeGoalPence: raffle.causeGoalPence,
    label,
    cta,
    onSale: raffle.state === "live" || raffle.state === "last_few",
  };
});

// Bulk sends (e.g. lottery results to every subscriber) run outside a React
// render, where cache() does nothing, so remember the text for a minute.
let memo: { text: string; at: number } | null = null;

/** Forget the remembered promo, e.g. straight after a raffle is edited. */
export function resetRafflePromoMemo() {
  memo = null;
}

/** The plain-text promo appended to lottery and booking emails, or "". */
export async function rafflePromoText(now = Date.now()) {
  if (memo && now - memo.at < 60_000) return memo.text;
  const promo = await getRafflePromo();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org";
  const text =
    promo && promo.onSale
      ? `This month's raffle: ${promo.title}. ${promo.price} a ticket, ${promo.label.toLowerCase()}. ${appUrl}/raffles/${promo.slug}`
      : "";
  memo = { text, at: now };
  return text;
}
