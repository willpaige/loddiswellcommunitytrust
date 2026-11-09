import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { raffleInterest, raffleOrders } from "@/lib/db/schema";
import { verifyUnsubscribeToken } from "@/lib/raffles/unsubscribe";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Raffle emails", robots: { index: false } };

// A button rather than acting on page load: email security scanners open
// links to check them, and must not unsubscribe people by doing so.
async function unsubscribe(formData: FormData) {
  "use server";
  const email = String(formData.get("e") ?? "").trim().toLowerCase();
  const token = String(formData.get("t") ?? "");
  if (!email || !verifyUnsubscribeToken(email, token)) return;
  // No more "on sale" or "next raffle" emails. Ticket confirmations and
  // results for raffles they have entered still come.
  await db.update(raffleOrders).set({ marketingOptOut: true }).where(sql`lower(${raffleOrders.email}) = ${email}`);
  await db.delete(raffleInterest).where(eq(raffleInterest.email, email));
  redirect(`/raffles/unsubscribe?done=1`);
}

export default async function RaffleUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string; done?: string }>;
}) {
  const { e, t, done } = await searchParams;
  const email = (e ?? "").trim().toLowerCase();
  const valid = !!email && !!t && verifyUnsubscribeToken(email, t);

  return (
    <div className="bg-background pt-36 pb-20">
      <div className="mx-auto max-w-lg space-y-4 px-4 text-center">
        {done ? (
          <>
            <h1 className="font-serif text-3xl">You&apos;re unsubscribed</h1>
            <p className="text-muted-foreground">
              We won&apos;t email you about new raffles. If you buy tickets, you&apos;ll still get your ticket numbers and the results for that raffle.
            </p>
          </>
        ) : valid ? (
          <>
            <h1 className="font-serif text-3xl">Stop raffle emails?</h1>
            <p className="text-muted-foreground">We won&apos;t email {email} when new raffles go on sale.</p>
            <form action={unsubscribe}>
              <input type="hidden" name="e" value={email} />
              <input type="hidden" name="t" value={t} />
              <Button type="submit" className="h-11">
                Unsubscribe
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl">This link isn&apos;t valid</h1>
            <p className="text-muted-foreground">
              The link may have been cut short. Try copying the whole link from the email, or contact us and we&apos;ll remove you.
            </p>
          </>
        )}
        <Link href="/" className="block text-copper-700 underline">
          Back to the home page
        </Link>
      </div>
    </div>
  );
}
