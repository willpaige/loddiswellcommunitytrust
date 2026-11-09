import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailLogs } from "@/lib/db/schema";
import { sendTemplateEmail } from "@/lib/email/send";
import type { EmailTemplateKey } from "@/lib/email/defaults";

// One email per recipient, sent one after another. Shared by the lottery and
// raffle draws. Every send goes through sendTemplateEmail, which skips an
// address already logged as sent for the same relatedEntityId. That is what
// makes a re-run safe: "Retry failed" just sends the same batch again.
//
// Sequential sends of a few hundred finish well inside the 300s function
// limit. Past ~500 recipients this should move to Postmark's batch API.

export type BulkEmail = {
  key: EmailTemplateKey;
  to: string;
  variables: Record<string, string | number | null | undefined>;
  /** Unique per recipient and purpose, e.g. `${drawId}:${email}`. */
  relatedEntityId: string;
};

export type BulkSendResult = {
  sent: number;
  failed: number;
  /** Already sent earlier, template disabled, or email not configured. */
  skipped: number;
  failedRecipients: string[];
};

export async function sendBulkTemplateEmails(
  emails: BulkEmail[],
  relatedEntityType: string
): Promise<BulkSendResult> {
  const result: BulkSendResult = { sent: 0, failed: 0, skipped: 0, failedRecipients: [] };
  for (const email of emails) {
    try {
      const outcome = await sendTemplateEmail({
        key: email.key,
        to: email.to,
        variables: email.variables,
        relatedEntityType,
        relatedEntityId: email.relatedEntityId,
      });
      if (outcome.sent) result.sent += 1;
      else result.skipped += 1;
    } catch {
      // sendTemplateEmail has already logged the failure. A bad address
      // (e.g. a Postmark suppression) must not stop the rest of the run.
      result.failed += 1;
      result.failedRecipients.push(email.to);
    }
  }
  return result;
}

/**
 * Recipients whose latest attempt for a batch failed and who have never been
 * sent it, for the "Retry failed" count. `idPrefix` matches the batch's
 * relatedEntityIds, e.g. `${drawId}:`.
 */
export async function countUndeliveredInBatch(relatedEntityType: string, idPrefix: string) {
  const escaped = idPrefix.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await db
    .select({ relatedEntityId: emailLogs.relatedEntityId })
    .from(emailLogs)
    .where(and(eq(emailLogs.relatedEntityType, relatedEntityType), like(emailLogs.relatedEntityId, `${escaped}%`)))
    .groupBy(emailLogs.relatedEntityId, emailLogs.recipient, emailLogs.templateKey)
    .having(
      sql`bool_or(${emailLogs.status} = 'failed') and not bool_or(${emailLogs.status} = 'sent')`
    );
  return rows.length;
}
