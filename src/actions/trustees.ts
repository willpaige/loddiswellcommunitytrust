"use server";

import { db } from "@/lib/db";
import { trustees } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";

export async function getTrustees() {
  return db
    .select()
    .from(trustees)
    .orderBy(asc(trustees.sortOrder), asc(trustees.name));
}

export async function getPublishedTrustees() {
  return db
    .select()
    .from(trustees)
    .where(eq(trustees.published, true))
    .orderBy(asc(trustees.sortOrder), asc(trustees.name));
}

export async function getTrustee(id: string) {
  const rows = await db
    .select()
    .from(trustees)
    .where(eq(trustees.id, id))
    .limit(1);
  return rows[0] ?? null;
}

function readForm(formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim();
  const role = ((formData.get("role") as string) || "").trim();
  const bio = ((formData.get("bio") as string) || "").trim() || null;
  const photoUrl = ((formData.get("photoUrl") as string) || "").trim() || null;
  const sortOrderRaw = (formData.get("sortOrder") as string) || "";
  const sortOrder = Number.isFinite(Number(sortOrderRaw))
    ? Number(sortOrderRaw)
    : 0;
  const published = formData.get("published") !== "off";
  return { name, role, bio, photoUrl, sortOrder, published };
}

export async function createTrustee(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const data = readForm(formData);
  if (!data.name || !data.role) throw new Error("Name and role are required");

  const [row] = await db
    .insert(trustees)
    .values({
      name: data.name,
      role: data.role,
      bio: data.bio,
      photoUrl: data.photoUrl,
      sortOrder: data.sortOrder,
      published: data.published,
    })
    .returning({ id: trustees.id });

  await logAudit({
    action: "create",
    entity: "user",
    entityId: row.id,
    description: `Added trustee: ${data.name} (${data.role})`,
  });

  revalidatePath("/admin/trustees");
  revalidatePath("/about");
  redirect("/admin/trustees");
}

export async function updateTrustee(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const data = readForm(formData);
  if (!data.name || !data.role) throw new Error("Name and role are required");

  await db
    .update(trustees)
    .set({
      name: data.name,
      role: data.role,
      bio: data.bio,
      photoUrl: data.photoUrl,
      sortOrder: data.sortOrder,
      published: data.published,
      updatedAt: new Date(),
    })
    .where(eq(trustees.id, id));

  await logAudit({
    action: "update",
    entity: "user",
    entityId: id,
    description: `Updated trustee: ${data.name}`,
  });

  revalidatePath("/admin/trustees");
  revalidatePath("/about");
  redirect("/admin/trustees");
}

export async function deleteTrustee(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const trustee = await getTrustee(id);
  await db.delete(trustees).where(eq(trustees.id, id));

  await logAudit({
    action: "delete",
    entity: "user",
    entityId: id,
    description: `Deleted trustee${trustee ? `: ${trustee.name}` : ""}`,
  });

  revalidatePath("/admin/trustees");
  revalidatePath("/about");
}
