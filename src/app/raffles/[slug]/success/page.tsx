import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { CalendarPlus, Loader2, Mail } from "lucide-react";
import { db } from "@/lib/db";
import { raffleOrders, raffleTickets } from "@/lib/db/schema";
import { getPublicRaffleBySlug } from "@/lib/raffles/public";
import { formatPence, padTicket } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/raffles/share-buttons";
import { RefreshUntilReady } from "@/components/raffles/refresh-until-ready";
import { Confetti } from "@/components/raffles/confetti";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "You're in!", robots: { index: false } };

export default async function RaffleSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const [{ slug }, { session_id: sessionId }] = await Promise.all([params, searchParams]);
  const raffle = await getPublicRaffleBySlug(slug);
  if (!raffle) notFound();

  // The Checkout session id is unguessable, so it is safe to show the order
  // it belongs to. Without one there is nothing to show.
  const [order] = sessionId
    ? await db
        .select()
        .from(raffleOrders)
        .where(and(eq(raffleOrders.stripeCheckoutSessionId, sessionId), eq(raffleOrders.raffleId, raffle.id)))
        .limit(1)
    : [];
  const tickets = order
    ? await db
        .select({ n: raffleTickets.ticketNumber })
        .from(raffleTickets)
        .where(eq(raffleTickets.orderId, order.id))
        .orderBy(asc(raffleTickets.ticketNumber))
    : [];
  const ready = order?.status === "paid" && tickets.length === order.quantity;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${appUrl}/raffles/${raffle.slug}`;
  const firstName = order?.name.split(" ")[0];

  return (
    <div className="bg-background pt-32 pb-20 sm:pt-36">
      <div className="mx-auto max-w-xl px-4 sm:px-6">
        {!ready ? (
          <div className="space-y-4 text-center">
            {order && order.status === "pending" && <RefreshUntilReady />}
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-copper-600" aria-hidden="true" />
            <h1 className="font-serif text-3xl">Allocating your ticket numbers…</h1>
            <p className="text-muted-foreground">
              Your payment has gone through. This usually takes a few seconds. Your numbers will also arrive by email.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <Confetti />
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-600">Payment received</p>
              <h1 className="mt-2 font-serif text-4xl">You&apos;re in{firstName ? `, ${firstName}` : ""}!</h1>
              <p className="mt-3 text-muted-foreground">
                Here {tickets.length === 1 ? "is your ticket" : `are your ${tickets.length} tickets`} for {raffle.title}.
              </p>
            </div>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Your ticket numbers">
              {tickets.map((t) => (
                <li key={t.n} className="rounded-md border-2 border-dashed border-copper-600 bg-copper-50 p-3 text-center">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ticket</span>
                  <span className="font-serif text-xl font-bold">#{padTicket(t.n)}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {order.email ? `A copy is on its way to ${order.email}.` : "Keep a note of your numbers."} Paid {formatPence(order.amount)}.
            </p>
            <div className="space-y-3 rounded-lg border p-5">
              <p className="font-semibold">Draw: {formatUk(raffle.drawAt, "EEEE d MMMM 'at' h:mmaaa")}</p>
              <p className="text-sm text-muted-foreground">
                {raffle.liveStreamUrl ? "Live on the Trust's Facebook page. " : ""}We&apos;ll email you the results either way.
              </p>
              <Button asChild variant="outline" className="h-11">
                <a href={`/raffles/${raffle.slug}/calendar.ics`}>
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
                </a>
              </Button>
            </div>
            <div className="space-y-3">
              <p className="font-semibold">Get your neighbours in</p>
              <ShareButtons url={url} text={`I've just entered ${raffle.title}. Tickets are ${formatPence(raffle.ticketPricePence)}!`} />
              <Button asChild variant="link" className="px-0 text-copper-700">
                <Link href={`/raffles/${raffle.slug}`}>Buy more tickets</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
