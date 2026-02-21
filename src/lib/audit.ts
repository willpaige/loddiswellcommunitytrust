import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { auth } from "@/lib/auth";

type AuditAction = "create" | "update" | "delete" | "publish" | "unpublish" | "upload" | "login";
type AuditEntity = "event" | "page" | "facility" | "document" | "image" | "lottery" | "user";

export async function logAudit({
  action,
  entity,
  entityId,
  description,
  metadata,
}: {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;

  await db.insert(auditLog).values({
    userId,
    userEmail,
    action,
    entity,
    entityId,
    description,
    metadata,
  });
}
