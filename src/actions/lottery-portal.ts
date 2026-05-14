"use server";

import { ServerClient } from "postmark";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { lotteryTickets } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPostmark() {
  return new ServerClient(process.env.POSTMARK_API_KEY!);
}

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

    await getPostmark().sendEmail({
      From: process.env.EMAIL_FROM || "noreply@loddiswellcommunitytrust.org",
      To: email,
      Subject: "Manage your Loddiswell lottery subscription",
      TextBody: [
        "Hi,",
        "",
        "Tap the link below to manage your Loddiswell Community Lottery subscription. From here you can update your payment details, cancel, or download invoices.",
        "",
        session.url,
        "",
        "This link will expire shortly. If you didn't request it, you can ignore this email.",
        "",
        "— The Loddiswell Trust",
      ].join("\n"),
      HtmlBody: `
        <p>Hi,</p>
        <p>Tap the button below to manage your Loddiswell Community Lottery subscription. From here you can update your payment details, cancel, or download invoices.</p>
        <p style="margin: 24px 0;">
          <a href="${session.url}" style="background:#3B4830;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Manage subscription</a>
        </p>
        <p style="color:#666;font-size:14px;">Or copy this link: <br><a href="${session.url}">${session.url}</a></p>
        <p style="color:#666;font-size:14px;">This link will expire shortly. If you didn't request it, you can ignore this email.</p>
        <p style="color:#666;font-size:14px;">— The Loddiswell Trust</p>
      `,
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
