"use server";

import { createId } from "@paralleldrive/cuid2";
import { ServerClient } from "postmark";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailLogs, emailTemplates, siteSettings } from "@/lib/db/schema";
import { renderEmailHtml, type EmailExtras } from "@/lib/email/layout";
import { buttonLabelFor, decorate } from "@/lib/email/decor";
import { rafflePromoForEmail } from "@/lib/raffles/promo";
import {
  emailTemplateDefaults,
  type EmailTemplateKey,
} from "@/lib/email/defaults";

type SendTemplateEmailInput = {
  key: EmailTemplateKey;
  to: string;
  variables: Record<string, string | number | null | undefined>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  dedupe?: boolean;
  /** Structured parts of the HTML email that the text body can't carry. */
  extras?: EmailExtras;
};

function getPostmark() {
  return new ServerClient(process.env.POSTMARK_API_KEY!);
}

function interpolate(template: string, variables: Record<string, string | number | null | undefined>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export async function ensureEmailTemplates() {
  const existing = await db.select({ key: emailTemplates.key }).from(emailTemplates);
  const existingKeys = new Set(existing.map((row) => row.key));
  const missing = emailTemplateDefaults.filter((template) => !existingKeys.has(template.key));
  if (missing.length === 0) return;

  await db.insert(emailTemplates).values(
    missing.map((template) => ({
      id: createId(),
      key: template.key,
      category: template.category,
      name: template.name,
      description: template.description,
      subject: template.subject,
      body: template.body,
      variables: template.variables,
      enabled: true,
    }))
  ).onConflictDoNothing({ target: emailTemplates.key });
}

export async function sendTemplateEmail({
  key,
  to,
  variables,
  relatedEntityType,
  relatedEntityId,
  dedupe = true,
  extras,
}: SendTemplateEmailInput) {
  if (!process.env.POSTMARK_API_KEY || !to) return { sent: false, skipped: true, reason: "not_configured" };
  await ensureEmailTemplates();

  if (dedupe && relatedEntityType && relatedEntityId) {
    const existing = await db
      .select({ id: emailLogs.id, providerMessageId: emailLogs.providerMessageId })
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.templateKey, key),
          eq(emailLogs.recipient, to),
          eq(emailLogs.relatedEntityType, relatedEntityType),
          eq(emailLogs.relatedEntityId, relatedEntityId),
          eq(emailLogs.status, "sent")
        )
      )
      .limit(1);
    if (existing.length > 0) return { sent: false, skipped: true, reason: "duplicate", messageId: existing[0].providerMessageId };
  }

  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, key)).limit(1);
  if (!template?.enabled) return { sent: false, skipped: true, reason: "disabled" };

  const [settings] = await db.select().from(siteSettings).limit(1);
  // Cross-sell: any template can include {{rafflePromo}}, which is the current
  // raffle's one-liner (a card with its artwork in the HTML), or nothing when
  // no raffle is on sale.
  const promo =
    template.body.includes("{{rafflePromo}}") && variables.rafflePromo === undefined
      ? await rafflePromoForEmail()
      : null;
  const allVariables = promo ? { ...variables, rafflePromo: promo.text } : variables;
  const subject = interpolate(template.subject, allVariables);
  // An empty variable can leave a run of blank lines; tidy them up.
  const body = interpolate(template.body, allVariables).replace(/\n{3,}/g, "\n\n").trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org";
  const html = renderEmailHtml({
    body,
    variables: allVariables,
    extras: decorate(key, allVariables, body, { ...extras, promo: extras?.promo ?? promo?.card ?? null }),
    buttonLabel: buttonLabelFor(key),
    appUrl,
  });
  const unsubscribe = typeof variables.unsubscribeUrl === "string" ? variables.unsubscribeUrl : "";

  try {
    const result = await getPostmark().sendEmail({
      From: process.env.EMAIL_FROM || "hello@loddiswellcommunitytrust.org",
      To: to,
      Subject: subject,
      TextBody: body,
      HtmlBody: html,
      MessageStream: "outbound",
      ReplyTo: settings?.emailAddress || undefined,
      // Lets Gmail and Apple Mail show their own "Unsubscribe" button.
      Headers: unsubscribe ? [{ Name: "List-Unsubscribe", Value: `<${unsubscribe}>` }] : undefined,
    });
    await db.insert(emailLogs).values({
      id: createId(),
      templateKey: key,
      recipient: to,
      relatedEntityType,
      relatedEntityId,
      status: "sent",
      providerMessageId: result.MessageID,
    });
    return { sent: true, skipped: false, messageId: result.MessageID };
  } catch (error) {
    await db.insert(emailLogs).values({
      id: createId(),
      templateKey: key,
      recipient: to,
      relatedEntityType,
      relatedEntityId,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown email error",
    });
    throw error;
  }
}
