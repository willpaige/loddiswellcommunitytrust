import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Who hears about a raffle when it goes on sale: every address the Trust
// holds (lottery players, booking customers, newsletter subscribers, site
// accounts, past raffle entrants and "remind me" sign-ups), minus anyone who
// has unsubscribed from raffle news, ticked "no raffle news" at a raffle
// checkout, or unsubscribed from the newsletter. Every email carries a
// one-click unsubscribe link.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function getRaffleLaunchAudience(raffleId: string): Promise<string[]> {
  const result = await db.execute(sql`
    with everyone as (
      select email from lottery_tickets
      union select customer_email from bookings
      union select email from newsletter_subscribers where status = 'active'
      union select email from users
      union select email from raffle_orders where status = 'paid' and email is not null
      union select email from raffle_interest where notified_at is null and (raffle_id = ${raffleId} or raffle_id is null)
    ),
    opted_out as (
      select email from raffle_email_opt_outs
      union select email from raffle_orders where marketing_opt_out and email is not null
      union select email from newsletter_subscribers where status = 'unsubscribed'
    )
    select distinct lower(trim(email)) as email from everyone
    where email is not null
      and lower(trim(email)) not in (select lower(trim(email)) from opted_out)
    order by 1
  `);
  const rows = (result as unknown as { rows: { email: string }[] }).rows ?? [];
  return rows.map((r) => r.email).filter((e) => EMAIL.test(e));
}
