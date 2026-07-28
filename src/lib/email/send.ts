"use server";

import { createId } from "@paralleldrive/cuid2";
import { ServerClient } from "postmark";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailLogs, emailTemplates, siteSettings } from "@/lib/db/schema";
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
};

function getPostmark() {
  return new ServerClient(process.env.POSTMARK_API_KEY!);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function interpolate(template: string, variables: Record<string, string | number | null | undefined>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

function renderBodyTextAsHtml(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => {
      const escaped = escapeHtml(paragraph.trim()).replace(/\n/g, "<br>");
      return escaped ? `<p>${escaped}</p>` : "";
    })
    .join("");
}

function brandedEmailHtml(contentHtml: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f1ea;font-family:Arial,sans-serif;color:#2c2a27;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d8d0c5;">
            <tr>
              <td style="background:#2f3b28;color:#ffffff;padding:28px 32px;font-family:Georgia,serif;font-size:24px;font-weight:bold;">
                Loddiswell Community Trust
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-size:16px;line-height:1.6;">
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e6dfd6;padding:20px 32px;color:#766f66;font-size:13px;">
                Loddiswell Playing Fields &amp; Village Hall Trust
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
  );
}

export async function sendTemplateEmail({
  key,
  to,
  variables,
  relatedEntityType,
  relatedEntityId,
  dedupe = true,
}: SendTemplateEmailInput) {
  if (!process.env.POSTMARK_API_KEY || !to) return { sent: false, skipped: true };
  await ensureEmailTemplates();

  if (dedupe && relatedEntityType && relatedEntityId) {
    const existing = await db
      .select({ id: emailLogs.id })
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
    if (existing.length > 0) return { sent: false, skipped: true };
  }

  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, key)).limit(1);
  if (!template?.enabled) return { sent: false, skipped: true };

  const [settings] = await db.select().from(siteSettings).limit(1);
  const subject = interpolate(template.subject, variables);
  const body = interpolate(template.body, variables);
  const html = brandedEmailHtml(renderBodyTextAsHtml(body));

  try {
    const result = await getPostmark().sendEmail({
      From: process.env.EMAIL_FROM || "noreply@loddiswellcommunitytrust.org",
      To: to,
      Subject: subject,
      TextBody: body,
      HtmlBody: html,
      MessageStream: "outbound",
      ReplyTo: settings?.emailAddress || undefined,
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
    return { sent: true, skipped: false };
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
