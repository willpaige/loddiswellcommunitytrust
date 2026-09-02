"use server";

import { desc, eq, and, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { lotteryDraws, lotteryTicketNumbers, lotteryTickets } from "@/lib/db/schema";
import { getTicketHoldersForTickets } from "@/actions/lottery-ticket-holders";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { sendTemplateEmail } from "@/lib/email/send";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestPortalLink(
  formData: FormData
): Promise<{ ok: true } | { error: string }> {
  const raw = formData.get("email");
  const email =
    typeof raw === "string" ? raw.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  // Look up an active or canceled-but-not-yet-expired Stripe sub for this email
  const rows = await db
    .select()
    .from(lotteryTickets)
    .where(
      and(
        eq(lotteryTickets.email, email),
        isNotNull(lotteryTickets.stripeCustomerId)
      )
    )
    .limit(1);

  // Always return ok to prevent email enumeration
  if (rows.length === 0 || !rows[0].stripeCustomerId) {
    return { ok: true };
  }

  const customerId = rows[0].stripeCustomerId;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/lottery`,
    });

    await sendTemplateEmail({
      key: "lottery_manage_link",
      to: email,
      variables: { manageUrl: session.url },
      relatedEntityType: "lottery",
      relatedEntityId: `${rows[0].id}:manage-link:${Date.now()}`,
      dedupe: false,
    });

    await logAudit({
      action: "login",
      entity: "lottery",
      entityId: rows[0].id,
      description: `Sent billing portal link to ${email}`,
    });
  } catch (err) {
    console.error("Failed to send portal link:", err);
    // Still return ok to maintain anti-enumeration
  }

  return { ok: true };
}

export async function getCustomerLotteryEntries() {
  const session = await auth();
  if (!session?.user?.email) redirect("/account/login?callbackUrl=/account/lottery");

  const tickets = await db
    .select()
    .from(lotteryTickets)
    .where(eq(lotteryTickets.email, session.user.email.toLowerCase()))
    .orderBy(desc(lotteryTickets.purchaseDate));
  const holdersByTicket = await getTicketHoldersForTickets(
    tickets.map((t) => t.id)
  );

  return tickets.map((ticket) => ({
    ...ticket,
    holders: holdersByTicket.get(ticket.id) ?? [],
  }));
}

function normaliseMatchValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getCustomerLotteryWins() {
  const session = await auth();
  if (!session?.user?.email) redirect("/account/login?callbackUrl=/account/lottery");

  const email = session.user.email.toLowerCase();
  const [entries, numbers, draws] = await Promise.all([
    db
      .select({ name: lotteryTickets.name, email: lotteryTickets.email })
      .from(lotteryTickets)
      .where(eq(lotteryTickets.email, email)),
    db
      .select({
        ticketNumber: lotteryTicketNumbers.ticketNumber,
        holderName: lotteryTicketNumbers.holderName,
      })
      .from(lotteryTicketNumbers)
      .innerJoin(lotteryTickets, eq(lotteryTicketNumbers.ticketId, lotteryTickets.id))
      .where(eq(lotteryTickets.email, email)),
    db
      .select({
        id: lotteryDraws.id,
        drawDate: lotteryDraws.drawDate,
        results: lotteryDraws.results,
      })
      .from(lotteryDraws)
      .where(eq(lotteryDraws.published, true))
      .orderBy(desc(lotteryDraws.drawDate)),
  ]);

  const matchValues = new Set([
    normaliseMatchValue(email),
    ...entries.map((entry) => normaliseMatchValue(entry.name)),
    ...numbers
      .map((n) => n.holderName)
      .filter((n): n is string => Boolean(n))
      .map(normaliseMatchValue),
  ]);
  // Ticket numbers are global and never reissued, so a past win on a number
  // this account has held is theirs even if the winner name was edited.
  const ownedNumbers = new Set(numbers.map((n) => n.ticketNumber));

  return draws.flatMap((draw) =>
    draw.results
      .filter(
        (result) =>
          matchValues.has(normaliseMatchValue(result.winner)) ||
          (typeof result.ticketNumber === "number" &&
            ownedNumbers.has(result.ticketNumber))
      )
      .map((result) => ({
        drawId: draw.id,
        drawDate: draw.drawDate,
        rank: result.rank,
        winner: result.winner,
        prize: result.prize,
        ticketNumber: result.ticketNumber,
      }))
  );
}

export async function createCustomerLotteryPortalSession(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) redirect("/account/login?callbackUrl=/account/lottery");

  const ticketId = String(formData.get("ticketId") || "");
  const [ticket] = await db
    .select()
    .from(lotteryTickets)
    .where(
      and(
        eq(lotteryTickets.id, ticketId),
        eq(lotteryTickets.email, session.user.email.toLowerCase())
      )
    )
    .limit(1);

  if (!ticket?.stripeCustomerId) {
    throw new Error("This lottery entry cannot be managed through Stripe.");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: ticket.stripeCustomerId,
    return_url: `${appUrl}/account/lottery`,
  });

  await logAudit({
    action: "login",
    entity: "lottery",
    entityId: ticket.id,
    description: `Opened customer lottery billing portal for ${ticket.email}`,
  });

  redirect(portalSession.url);
}
