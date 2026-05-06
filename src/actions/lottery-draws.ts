"use server";

import { db } from "@/lib/db";
import { lotteryDraws } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";

export type DrawResult = { rank: number; winner: string; prize: string };

export async function getDraws() {
  return db.select().from(lotteryDraws).orderBy(desc(lotteryDraws.drawDate));
}

export async function getPublishedDraws(limit?: number) {
  const query = db
    .select()
    .from(lotteryDraws)
    .where(eq(lotteryDraws.published, true))
    .orderBy(desc(lotteryDraws.drawDate));
  return limit ? query.limit(limit) : query;
}

export async function getDraw(id: string) {
  const rows = await db
    .select()
    .from(lotteryDraws)
    .where(eq(lotteryDraws.id, id))
    .limit(1);
  return rows[0] ?? null;
}

function parseResults(raw: string | null | undefined): DrawResult[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, i) => ({
        rank: Number(item?.rank ?? i + 1) || i + 1,
        winner: typeof item?.winner === "string" ? item.winner.trim() : "",
        prize: typeof item?.prize === "string" ? item.prize.trim() : "",
      }))
      .filter((r) => r.winner || r.prize);
  } catch {
    return [];
  }
}

export async function createDraw(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const drawDateRaw = formData.get("drawDate") as string;
  if (!drawDateRaw) throw new Error("Draw date required");

  const results = parseResults(formData.get("results") as string);
  const notes = (formData.get("notes") as string)?.trim() || null;
  const published = formData.get("published") !== "off";

  const [row] = await db
    .insert(lotteryDraws)
    .values({
      drawDate: new Date(drawDateRaw),
      results,
      notes,
      published,
      createdBy: session.user.id,
    })
    .returning({ id: lotteryDraws.id });

  await logAudit({
    action: "create",
    entity: "lottery",
    entityId: row.id,
    description: `Created lottery draw for ${new Date(drawDateRaw).toDateString()}`,
  });

  revalidatePath("/admin/lottery");
  revalidatePath("/lottery");
  redirect("/admin/lottery");
}

export async function updateDraw(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const drawDateRaw = formData.get("drawDate") as string;
  if (!drawDateRaw) throw new Error("Draw date required");

  const results = parseResults(formData.get("results") as string);
  const notes = (formData.get("notes") as string)?.trim() || null;
  const published = formData.get("published") !== "off";

  await db
    .update(lotteryDraws)
    .set({
      drawDate: new Date(drawDateRaw),
      results,
      notes,
      published,
    })
    .where(eq(lotteryDraws.id, id));

  await logAudit({
    action: "update",
    entity: "lottery",
    entityId: id,
    description: `Updated lottery draw for ${new Date(drawDateRaw).toDateString()}`,
  });

  revalidatePath("/admin/lottery");
  revalidatePath("/lottery");
  redirect("/admin/lottery");
}

export async function deleteDraw(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db
    .delete(lotteryDraws)
    .where(and(eq(lotteryDraws.id, id)));

  await logAudit({
    action: "delete",
    entity: "lottery",
    entityId: id,
    description: "Deleted lottery draw",
  });

  revalidatePath("/admin/lottery");
  revalidatePath("/lottery");
}
