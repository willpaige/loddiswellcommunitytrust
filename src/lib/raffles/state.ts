// What a raffle page shows is decided here, from the raffle's dates and
// counters, on every request. No cron flips states; the public page and the
// admin list both call this so they always agree.

export type RaffleState =
  | "draft"
  | "cancelled"
  | "coming_soon"
  | "live"
  | "last_few"
  | "sold_out"
  | "closed"
  | "drawn";

export type RaffleStateInput = {
  published: boolean;
  cancelledAt: Date | null;
  salesOpenAt: Date;
  salesCloseAt: Date;
  maxTickets: number | null;
  /** Tickets sold plus tickets held by checkouts still in progress. */
  ticketsReserved: number;
};

const DAY = 24 * 60 * 60 * 1000;
/** "Last few" kicks in at 90% sold or the final 24 hours of sales. */
const LAST_FEW_SHARE = 0.9;

export function ticketsRemaining(raffle: Pick<RaffleStateInput, "maxTickets" | "ticketsReserved">) {
  if (raffle.maxTickets === null) return null;
  return Math.max(0, raffle.maxTickets - raffle.ticketsReserved);
}

export function deriveRaffleState(
  raffle: RaffleStateInput,
  options: { drawPublished?: boolean; now?: Date } = {}
): RaffleState {
  const now = options.now ?? new Date();
  if (!raffle.published) return "draft";
  if (raffle.cancelledAt) return "cancelled";
  if (options.drawPublished) return "drawn";
  if (now < raffle.salesOpenAt) return "coming_soon";
  if (now >= raffle.salesCloseAt) return "closed";

  const remaining = ticketsRemaining(raffle);
  if (remaining === 0) return "sold_out";
  const nearlyGone =
    raffle.maxTickets !== null && raffle.ticketsReserved >= raffle.maxTickets * LAST_FEW_SHARE;
  const endingSoon = raffle.salesCloseAt.getTime() - now.getTime() <= DAY;
  return nearlyGone || endingSoon ? "last_few" : "live";
}

/** States in which tickets can be bought online. */
export function isOnSale(state: RaffleState) {
  return state === "live" || state === "last_few";
}
