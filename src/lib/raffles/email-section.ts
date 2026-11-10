import { getRecentDrawnRaffles, getRunningRaffles } from "@/lib/raffles/public";
import { winnerNames } from "@/lib/raffles/draw";
import { formatPence, formatTicket } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";

// The raffles block for the lottery results email ({{raffles}}): every raffle
// that's running, then the results of any raffle drawn in the last month.
// Empty when there's nothing to say, and the email tidies the gap away.

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org";
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

export async function rafflesEmailSection(now = new Date()): Promise<string> {
  const [running, drawn] = await Promise.all([getRunningRaffles(now), getRecentDrawnRaffles(3)]);
  const lines: string[] = [];

  for (const r of running) {
    const url = `${appUrl()}/raffles/${r.slug}`;
    const draw = `Draw ${formatUk(r.drawAt, "EEEE d MMMM 'at' h:mmaaa")}`;
    const price = `${formatPence(r.ticketPricePence)} a ticket`;
    const cause = r.causeTitle ? `, for ${r.causeTitle}` : "";
    if (r.state === "coming_soon") {
      lines.push(`Coming soon: ${r.title}. On sale ${formatUk(r.salesOpenAt, "EEEE d MMMM")}, ${price}${cause}. ${url}`);
    } else if (r.state === "live" || r.state === "last_few") {
      lines.push(`${r.title}: on sale now, ${price}${cause}. ${draw}. Get your tickets: ${url}`);
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

  if (lines.length === 0) return "";
  return ["Raffles", ...lines].join("\n\n") + `\n\n${running.some((r) => r.minAge >= 18) ? "18+ only. " : ""}Please gamble responsibly: BeGambleAware.org`;
}
