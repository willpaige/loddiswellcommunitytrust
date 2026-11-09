import { NextResponse } from "next/server";
import { getPublicRaffleBySlug } from "@/lib/raffles/public";

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** A calendar invite for the draw, offered after buying tickets. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  if (!raffle) return new NextResponse("Not found", { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${appUrl}/raffles/${raffle.slug}`;
  const end = new Date(raffle.drawAt.getTime() + 30 * 60 * 1000);
  const description = raffle.liveStreamUrl
    ? `Watch live: ${raffle.liveStreamUrl}\nResults: ${url}`
    : `Results: ${url}`;
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loddiswell Community Trust//Raffles//EN",
    "BEGIN:VEVENT",
    `UID:raffle-${raffle.id}@loddiswellcommunitytrust.org`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(raffle.drawAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escape(`Raffle draw: ${raffle.title}`)}`,
    `DESCRIPTION:${escape(description)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="raffle-draw-${raffle.slug}.ics"`,
    },
  });
}
