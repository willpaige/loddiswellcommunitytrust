import { getRecentDrawnRaffles, getRunningRaffles } from "@/lib/raffles/public";
import { winnerNames } from "@/lib/raffles/draw";
import { formatPence, formatTicket } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";
import type { EmailPromoCard } from "@/lib/email/layout";

// The raffles block for the lottery results email ({{raffles}}): every raffle
// that's running, then the results of any raffle drawn in the last month.
// Empty when there's nothing to say, and the email tidies the gap away.

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org";
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

export type RafflesEmailContent = {
  /** The {{raffles}} text, for the plain-text email and the HTML body. */
  text: string;
  /** The paragraph in `text` that the HTML replaces with the artwork card. */
  promoLine: string;
  card: EmailPromoCard | null;
};

/**
 * The raffles block plus, when a raffle is on sale, a card with its artwork
 * (the same card the welcome and booking emails show). The first raffle on
 * sale gets the card; its line stays in the plain-text version.
 */
export async function rafflesEmailContent(now = new Date()): Promise<RafflesEmailContent> {
  const [running, drawn] = await Promise.all([getRunningRaffles(now), getRecentDrawnRaffles(3)]);
  const lines: string[] = [];
  let promoLine = "";
  let card: EmailPromoCard | null = null;
  const gamble = `${running.some((r) => r.minAge >= 18) ? "18+ only. " : ""}Please gamble responsibly: BeGambleAware.org`;

  for (const r of running) {
    const url = `${appUrl()}/raffles/${r.slug}`;
    const draw = `Draw ${formatUk(r.drawAt, "EEEE d MMMM 'at' h:mmaaa")}`;
    const price = `${formatPence(r.ticketPricePence)} a ticket`;
    const cause = r.causeTitle ? `, for ${r.causeTitle}` : "";
    if (r.state === "coming_soon") {
      lines.push(`Coming soon: ${r.title}. On sale ${formatUk(r.salesOpenAt, "EEEE d MMMM")}, ${price}${cause}. ${url}`);
    } else if (r.state === "live" || r.state === "last_few") {
      const line = `${r.title}: on sale now, ${price}${cause}. ${draw}. Get your tickets: ${url}`;
      if (!card) {
        promoLine = line;
        card = {
          eyebrow: "Raffle on now",
          title: r.title,
          text: `${price}${cause}. Draw ${formatUk(r.drawAt, "EEE d MMM")}. ${gamble}`,
          url,
          imageUrl: r.heroImageUrl,
        };
      } else {
        lines.push(line);
      }
    } else {
      lines.push(`${r.title}: sales have closed. ${draw}. ${url}`);
    }
  }

  const monthAgo = now.getTime() - 31 * 24 * 60 * 60 * 1000;
  const recent = drawn.filter((r) => r.draw?.publishedAt && r.draw.publishedAt.getTime() >= monthAgo);
  for (const r of recent) {
    const results = r.draw!.results;
    const names = await winnerNames(results.map((w) => w.orderId));
    const winners = [...results]
      .sort((a, b) => a.rank - b.rank)
      .map((w) => `${ordinal(w.rank)} prize, ${w.prizeTitle}: ${names.get(w.orderId) ?? "a lucky entrant"} (ticket ${formatTicket(w.ticketNumber)})`)
      .join("; ");
    lines.push(`${r.title} results: ${winners}.`);
  }

  if (lines.length === 0 && !promoLine) return { text: "", promoLine: "", card: null };
  // When the card is the only running raffle, the gambling notice rides in
  // its paragraph (and in the card) instead of on a line of its own.
  const noticeInPromo = !!card && running.length === 1;
  const parts: string[] = [];
  if (promoLine) parts.push(noticeInPromo ? `${promoLine} ${gamble}` : promoLine);
  if (lines.length) parts.push("Raffles", ...lines);
  if (!noticeInPromo) parts.push(gamble);
  return { text: parts.join("\n\n"), promoLine: promoLine ? parts[0] : "", card };
}

/** Just the text, for callers that don't render the card. */
export async function rafflesEmailSection(now = new Date()): Promise<string> {
  return (await rafflesEmailContent(now)).text;
}
