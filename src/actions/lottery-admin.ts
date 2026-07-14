"use server";

import Papa from "papaparse";
import { addYears, format } from "date-fns";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { lotteryTicketNumbers, lotteryTickets, lotteryDraws } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ensureAllLotteryTicketNumbers,
  ensureLotteryTicketNumbers,
  ticketNumbersText,
} from "@/actions/lottery-ticket-numbers";
import { sendTemplateEmail } from "@/lib/email/send";
import { upsertCustomerRecord } from "@/actions/customer-records";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Cancel a Stripe subscription (end of period) ──

export async function cancelSubscription(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const rows = await db
    .select()
    .from(lotteryTickets)
    .where(eq(lotteryTickets.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Subscriber not found");
  if (!row.stripeSubscriptionId) {
    throw new Error("This subscriber has no Stripe subscription");
  }

  await getStripe().subscriptions.update(row.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await logAudit({
    action: "update",
    entity: "lottery",
    entityId: row.id,
    description: `Scheduled cancellation for ${row.email} at period end`,
  });

  // Webhook will reconcile cancelAtPeriodEnd / canceledAt; no DB write here.
  revalidatePath("/admin/lottery");
}

// ── Manual subscriber CRUD ──

function readManualForm(formData: FormData) {
  const name = ((formData.get("name") as string) || "").trim();
  const email = ((formData.get("email") as string) || "").trim().toLowerCase();
  const phone = ((formData.get("phone") as string) || "").trim() || null;
  const quantityRaw = (formData.get("quantity") as string) || "1";
  const quantity = Math.max(1, Math.min(50, Number(quantityRaw) || 1));
  const notes = ((formData.get("notes") as string) || "").trim() || null;
  const expiryRaw = ((formData.get("expiryDate") as string) || "").trim();
  const expiryDate = expiryRaw ? new Date(expiryRaw) : addYears(new Date(), 1);
  return { name, email, phone, quantity, notes, expiryDate };
}

export async function createManualSubscriber(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const data = readManualForm(formData);
  if (!data.name || !data.email || !EMAIL_RE.test(data.email)) {
    throw new Error("Name and a valid email are required");
  }
  await upsertCustomerRecord({
    email: data.email,
    name: data.name,
    phone: data.phone,
  });

  const [ticket] = await db.insert(lotteryTickets).values({
    source: "manual",
    name: data.name,
    email: data.email,
    phone: data.phone,
    quantity: data.quantity,
    amount: data.quantity * 1200,
    purchaseDate: new Date(),
    expiryDate: data.expiryDate,
    notes: data.notes,
    status: "active",
  }).returning();
  await ensureLotteryTicketNumbers(ticket.id);
  await sendTemplateEmail({
    key: "lottery_welcome",
    to: data.email,
    variables: {
      name: data.name,
      quantity: data.quantity,
      ticketNumbers: await ticketNumbersText(ticket.id),
      manageUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/account/lottery`,
    },
    relatedEntityType: "lottery",
    relatedEntityId: `${ticket.id}:welcome`,
  });

  await logAudit({
    action: "create",
    entity: "lottery",
    entityId: data.email,
    description: `Added manual subscriber: ${data.name} (${data.email})`,
  });

  revalidatePath("/admin/lottery");
  redirect("/admin/lottery");
}

export async function updateManualSubscriber(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const data = readManualForm(formData);
  if (!data.name || !data.email || !EMAIL_RE.test(data.email)) {
    throw new Error("Name and a valid email are required");
  }
  await upsertCustomerRecord({
    email: data.email,
    name: data.name,
    phone: data.phone,
  });

  await db
    .update(lotteryTickets)
    .set({
      name: data.name,
      email: data.email,
      phone: data.phone,
      quantity: data.quantity,
      amount: data.quantity * 1200,
      expiryDate: data.expiryDate,
      notes: data.notes,
    })
    .where(
      and(
        eq(lotteryTickets.id, id),
        eq(lotteryTickets.source, "manual")
      )
    );
  await ensureLotteryTicketNumbers(id);

  await logAudit({
    action: "update",
    entity: "lottery",
    entityId: id,
    description: `Updated manual subscriber: ${data.name}`,
  });

  revalidatePath("/admin/lottery");
  redirect("/admin/lottery");
}

export async function deleteManualSubscriber(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db
    .delete(lotteryTickets)
    .where(
      and(
        eq(lotteryTickets.id, id),
        eq(lotteryTickets.source, "manual")
      )
    );

  await logAudit({
    action: "delete",
    entity: "lottery",
    entityId: id,
    description: "Deleted manual subscriber",
  });

  revalidatePath("/admin/lottery");
}

// ── CSV import ──

export type ImportResult = {
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
};

type CsvRow = {
  name?: string;
  email?: string;
  phone?: string;
  quantity?: string;
  notes?: string;
  expiryDate?: string;
};

export async function importLotterySubscribers(
  formData: FormData
): Promise<ImportResult> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { inserted: 0, skipped: 0, errors: [{ row: 0, reason: "No file" }] };
  }

  const text = await file.text();
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: ImportResult["errors"] = [];
  for (const err of parsed.errors) {
    errors.push({
      row: (err.row ?? 0) + 1,
      reason: `Parse error: ${err.message}`,
    });
  }

  const rows = parsed.data;
  type Insert = typeof lotteryTickets.$inferInsert;
  const validRows: Insert[] = [];
  const validEmails: string[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // +1 for header, +1 for human numbering
    const name = (row.name || "").trim();
    const email = (row.email || "").trim().toLowerCase();
    if (!name) {
      errors.push({ row: rowNum, reason: "Missing name" });
      return;
    }
    if (!email || !EMAIL_RE.test(email)) {
      errors.push({ row: rowNum, reason: "Missing or invalid email" });
      return;
    }
    const quantity = Math.max(
      1,
      Math.min(50, Number((row.quantity || "1").trim()) || 1)
    );
    const phone = (row.phone || "").trim() || null;
    const notes = (row.notes || "").trim() || null;
    const expiryRaw = (row.expiryDate || "").trim();
    let expiryDate: Date;
    if (expiryRaw) {
      const d = new Date(expiryRaw);
      if (isNaN(d.getTime())) {
        errors.push({
          row: rowNum,
          reason: `Invalid expiryDate "${expiryRaw}" (use YYYY-MM-DD)`,
        });
        return;
      }
      expiryDate = d;
    } else {
      expiryDate = addYears(new Date(), 1);
    }
    validRows.push({
      source: "manual",
      name,
      email,
      phone,
      quantity,
      amount: quantity * 1200,
      purchaseDate: new Date(),
      expiryDate,
      notes,
      status: "active",
    });
    validEmails.push(email);
  });

  let inserted = 0;
  let skipped = 0;

  if (validRows.length > 0) {
    // Find existing manual rows with matching emails to know which ones we're skipping
    const existing = await db
      .select({
        email: lotteryTickets.email,
      })
      .from(lotteryTickets)
      .where(
        and(
          inArray(lotteryTickets.email, validEmails),
          eq(lotteryTickets.source, "manual")
        )
      );
    const existingSet = new Set(existing.map((r) => r.email));
    skipped = validRows.filter((r) => existingSet.has(r.email)).length;

    const toInsert = validRows.filter((r) => !existingSet.has(r.email));
    if (toInsert.length > 0) {
      const rows = await db.insert(lotteryTickets).values(toInsert).returning();
      for (const row of rows) {
        await upsertCustomerRecord({
          email: row.email,
          name: row.name,
          phone: row.phone,
        });
        await ensureLotteryTicketNumbers(row.id);
        await sendTemplateEmail({
          key: "lottery_welcome",
          to: row.email,
          variables: {
            name: row.name,
            quantity: row.quantity,
            ticketNumbers: await ticketNumbersText(row.id),
            manageUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/account/lottery`,
          },
          relatedEntityType: "lottery",
          relatedEntityId: `${row.id}:welcome`,
        });
      }
      inserted = rows.length;
    }
  }

  await logAudit({
    action: "upload",
    entity: "lottery",
    description: `Imported lottery CSV: ${inserted} inserted, ${skipped} skipped, ${errors.length} errors`,
    metadata: {
      filename: (file as File).name,
      inserted,
      skipped,
      errorCount: errors.length,
    },
  });

  revalidatePath("/admin/lottery");
  return { inserted, skipped, errors };
}

// ── Random draw ──

export type DrawWinner = { name: string; email: string; ticketNumber: number };

export async function drawRandomWinners(
  prizeCount: number
): Promise<{
  winners: DrawWinner[];
  totalEntries: number;
  uniqueSubscribers: number;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (!Number.isFinite(prizeCount) || prizeCount < 1) {
    throw new Error("Prize count must be at least 1");
  }
  prizeCount = Math.min(50, Math.floor(prizeCount));
  await ensureAllLotteryTicketNumbers();

  const rows = await db
    .select({
      name: lotteryTicketNumbers.name,
      email: lotteryTicketNumbers.email,
      ticketNumber: lotteryTicketNumbers.ticketNumber,
    })
    .from(lotteryTicketNumbers)
    .innerJoin(lotteryTickets, eq(lotteryTicketNumbers.ticketId, lotteryTickets.id))
    .where(and(eq(lotteryTickets.status, "active"), eq(lotteryTicketNumbers.active, true)));

  const pool: DrawWinner[] = rows.map((row) => ({
    name: row.name,
    email: row.email.toLowerCase(),
    ticketNumber: row.ticketNumber,
  }));

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Walk shuffled list picking unique-by-email winners
  const winners: DrawWinner[] = [];
  const seen = new Set<string>();
  for (const entry of pool) {
    if (seen.has(entry.email)) continue;
    seen.add(entry.email);
    winners.push(entry);
    if (winners.length >= prizeCount) break;
  }

  return {
    winners,
    totalEntries: pool.length,
    uniqueSubscribers: new Set(rows.map((row) => row.email.toLowerCase())).size,
  };
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function sendDrawNotifications(
  drawId: string
): Promise<{ sent: number; alreadySent?: boolean }> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const drawRows = await db
    .select()
    .from(lotteryDraws)
    .where(eq(lotteryDraws.id, drawId))
    .limit(1);
  const draw = drawRows[0];
  if (!draw) throw new Error("Draw not found");
  if (draw.notifiedAt) {
    return { sent: 0, alreadySent: true };
  }

  // Active subscribers, de-duped by lowercase email
  const subs = await db
    .select({
      name: lotteryTickets.name,
      email: lotteryTickets.email,
    })
    .from(lotteryTickets)
    .where(eq(lotteryTickets.status, "active"));

  const recipientsByEmail = new Map<string, string>(); // email → name
  for (const s of subs) {
    const e = s.email.toLowerCase().trim();
    if (!e || !EMAIL_RE.test(e)) continue;
    if (!recipientsByEmail.has(e)) recipientsByEmail.set(e, s.name);
  }
  const recipients = Array.from(recipientsByEmail.entries()).map(
    ([email, name]) => ({ email, name })
  );

  if (recipients.length === 0) {
    return { sent: 0 };
  }

  const winnersText = draw.results
    .map((r) => {
      const ticket = r.ticketNumber ? ` ticket ${r.ticketNumber}` : "";
      return `${ordinal(r.rank)}: ${r.winner}${ticket} — ${r.prize}`;
    })
    .join("\n");
  let sent = 0;
  for (const recipient of recipients) {
    const result = await sendTemplateEmail({
      key: "lottery_draw_results",
      to: recipient.email,
      variables: {
        drawDate: format(draw.drawDate, "MMMM yyyy"),
        winners: winnersText,
        notes: draw.notes || "",
      },
      relatedEntityType: "lottery_draw",
      relatedEntityId: `${drawId}:${recipient.email}`,
    });
    if (result.sent) sent += 1;
  }

  await db
    .update(lotteryDraws)
    .set({ notifiedAt: new Date() })
    .where(eq(lotteryDraws.id, drawId));

  await logAudit({
    action: "update",
    entity: "lottery",
    entityId: drawId,
    description: `Sent draw notifications to ${sent} subscribers`,
  });

  revalidatePath("/admin/lottery");
  revalidatePath(`/admin/lottery/draws/${drawId}/edit`);

  return { sent };
}
