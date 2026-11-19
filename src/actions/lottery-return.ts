"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lotteryReturns, siteSettings, type LotteryReturnExpense } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/raffles/auth";
import { formatPounds, lotteryReturnDueBy, lotteryYearLabel } from "@/lib/lottery/return/figures";
import {
  emailLotteryReturn,
  getOrCreateLotteryReturn,
  loadLotteryReturn,
  lotteryYearsToDate,
} from "@/lib/lottery/return/service";

function parsePounds(value: FormDataEntryValue | null) {
  const pounds = Number(String(value ?? "").replace(/[£,\s]/g, "") || "0");
  if (!Number.isFinite(pounds) || pounds < 0) throw new Error("Enter an amount in pounds.");
  return Math.round(pounds * 100);
}

async function findReturn(id: string) {
  const [row] = await db.select().from(lotteryReturns).where(eq(lotteryReturns.id, id)).limit(1);
  if (!row) throw new Error("Return not found.");
  return row;
}

function refresh(id: string) {
  revalidatePath("/admin/lottery/returns");
  revalidatePath(`/admin/lottery/returns/${id}`);
  revalidatePath("/admin");
}

/** Every lottery year so far, newest first, with live figures. */
export async function listLotteryReturns() {
  await requireStaff();
  const rows = [];
  for (const year of lotteryYearsToDate()) rows.push(await getOrCreateLotteryReturn(year));
  return Promise.all(rows.map((row) => loadLotteryReturn(row)));
}

export async function getLotteryReturn(id: string) {
  await requireStaff();
  const [row] = await db.select().from(lotteryReturns).where(eq(lotteryReturns.id, id)).limit(1);
  return row ? loadLotteryReturn(row) : null;
}

export async function addLotteryReturnExpense(id: string, formData: FormData) {
  await requireStaff();
  const row = await findReturn(id);
  const category = String(formData.get("category") ?? "other") as LotteryReturnExpense["category"];
  if (!["lottery", "commission", "other"].includes(category)) throw new Error("Choose a category.");
  const description = String(formData.get("description") ?? "").trim().slice(0, 200);
  const amountPence = parsePounds(formData.get("amount"));
  if (amountPence === 0) throw new Error("Enter an amount.");
  const expense: LotteryReturnExpense = { id: crypto.randomUUID(), category, description, amountPence };
  await db
    .update(lotteryReturns)
    .set({ expenses: [...row.expenses, expense], updatedAt: new Date() })
    .where(eq(lotteryReturns.id, id));
  await logAudit({
    action: "update",
    entity: "lottery",
    entityId: id,
    description: `Added ${formatPounds(amountPence)} expense (${description || category}) to the ${lotteryYearLabel(row.periodStart)} lottery return`,
  });
  refresh(id);
}

export async function removeLotteryReturnExpense(id: string, expenseId: string) {
  await requireStaff();
  const row = await findReturn(id);
  const removed = row.expenses.find((e) => e.id === expenseId);
  await db
    .update(lotteryReturns)
    .set({ expenses: row.expenses.filter((e) => e.id !== expenseId), updatedAt: new Date() })
    .where(eq(lotteryReturns.id, id));
  if (removed) {
    await logAudit({ action: "update", entity: "lottery", entityId: id, description: `Removed ${formatPounds(removed.amountPence)} expense (${removed.description || removed.category}) from the ${lotteryYearLabel(row.periodStart)} lottery return` });
  }
  refresh(id);
}

export async function saveLotteryReturnDetails(id: string, formData: FormData) {
  await requireStaff();
  const row = await findReturn(id);
  const purpose = String(formData.get("purpose") ?? "").trim().slice(0, 300) || row.purpose;
  const otherProceedsPence = parsePounds(formData.get("otherProceeds"));
  await db.update(lotteryReturns).set({ purpose, otherProceedsPence, updatedAt: new Date() }).where(eq(lotteryReturns.id, id));
  await logAudit({ action: "update", entity: "lottery", entityId: id, description: `Updated the ${lotteryYearLabel(row.periodStart)} lottery return details` });
  refresh(id);
}

/** Registration number and promoter, printed on every return. */
export async function saveLotteryRegistration(formData: FormData) {
  await requireStaff();
  const registration = String(formData.get("registrationNumber") ?? "").trim().slice(0, 40);
  const promoter = String(formData.get("promoterName") ?? "").trim().slice(0, 120);
  if (!registration || !promoter) throw new Error("Enter the registration number and the promoter's name.");
  const [settings] = await db.select({ id: siteSettings.id }).from(siteSettings).limit(1);
  if (!settings) throw new Error("Site settings haven't been set up yet.");
  await db
    .update(siteSettings)
    .set({ lotteryRegistrationNumber: registration, lotteryPromoterName: promoter, updatedAt: new Date() })
    .where(eq(siteSettings.id, settings.id));
  await logAudit({ action: "update", entity: "lottery", description: `Set the lottery registration to ${registration}, promoter ${promoter}` });
  revalidatePath("/admin/lottery/returns", "layout");
}

export async function resendLotteryReturn(id: string) {
  await requireStaff();
  const row = await findReturn(id);
  const result = await emailLotteryReturn(row, { force: true });
  if (!result.sent) throw new Error(`The email wasn't sent (${result.reason}).`);
  await logAudit({ action: "update", entity: "lottery", entityId: id, description: `Emailed the ${lotteryYearLabel(row.periodStart)} lottery return to ${result.to}` });
  refresh(id);
}

export async function setLotteryReturnSubmitted(id: string, submitted: boolean) {
  await requireStaff();
  const row = await findReturn(id);
  await db.update(lotteryReturns).set({ submittedAt: submitted ? new Date() : null, updatedAt: new Date() }).where(eq(lotteryReturns.id, id));
  await logAudit({
    action: "update",
    entity: "lottery",
    entityId: id,
    description: submitted
      ? `Marked the ${lotteryYearLabel(row.periodStart)} lottery return as submitted to the council`
      : `Marked the ${lotteryYearLabel(row.periodStart)} lottery return as not submitted`,
  });
  refresh(id);
}

/** Finished lottery years whose return hasn't been submitted, for the dashboard. */
export async function getDueLotteryReturns(now = new Date()) {
  await requireStaff();
  const rows = await db.select().from(lotteryReturns);
  return rows
    .filter((r) => !r.submittedAt && r.periodEnd.getTime() <= now.getTime())
    .map((r) => {
      const dueBy = lotteryReturnDueBy(r.periodEnd);
      return { id: r.id, label: lotteryYearLabel(r.periodStart), dueBy, overdue: dueBy.getTime() < now.getTime() };
    })
    .sort((a, b) => a.dueBy.getTime() - b.dueBy.getTime());
}
