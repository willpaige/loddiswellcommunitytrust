"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/db/schema";
import { emailTemplateDefaults } from "@/lib/email/defaults";
import { ensureEmailTemplates } from "@/lib/email/send";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string } | undefined)?.role;
  if (!session?.user || (role !== "admin" && role !== "editor")) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getEmailTemplates(category?: string) {
  await requireAdmin();
  await ensureEmailTemplates();
  const rows = await db.select().from(emailTemplates);
  return rows
    .filter((row) => !category || row.category === category)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getEmailTemplate(key: string) {
  await requireAdmin();
  await ensureEmailTemplates();
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.key, key))
    .limit(1);
  return template ?? null;
}

export async function updateEmailTemplate(key: string, formData: FormData) {
  const session = await requireAdmin();
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const enabled = formData.get("enabled") === "on";
  if (!subject || !body) throw new Error("Subject and body are required.");

  await db
    .update(emailTemplates)
    .set({
      subject,
      body,
      enabled,
      updatedAt: new Date(),
      updatedBy: session.user?.id,
    })
    .where(eq(emailTemplates.key, key));

  revalidatePath("/admin/emails");
  revalidatePath(`/admin/emails/${key}`);
}

export async function resetEmailTemplate(key: string) {
  await requireAdmin();
  const defaults = emailTemplateDefaults.find((template) => template.key === key);
  if (!defaults) throw new Error("Unknown template.");
  await db
    .update(emailTemplates)
    .set({
      subject: defaults.subject,
      body: defaults.body,
      variables: defaults.variables,
      enabled: true,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.key, key));
  revalidatePath("/admin/emails");
  revalidatePath(`/admin/emails/${key}`);
}
