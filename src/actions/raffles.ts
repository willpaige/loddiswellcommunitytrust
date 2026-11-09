"use server";

import { addMonths } from "date-fns";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { raffleDraws, raffleOrders, raffles, type RafflePrize } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/raffles/auth";
import { ukInputToDate } from "@/lib/raffles/time";

export type RaffleFormState = { error: string | null };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function poundsToPence(value: FormDataEntryValue | null) {
  const text = String(value ?? "").replace(/[£,\s]/g, "");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function optionalInt(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isInteger(n) ? n : NaN;
}

function parsePrizes(raw: FormDataEntryValue | null): RafflePrize[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => ({
        title: String(p?.title ?? "").trim(),
        description: String(p?.description ?? "").trim() || undefined,
        valuePence: Math.max(0, Math.round(Number(p?.valuePence) || 0)),
        costPence: Math.max(0, Math.round(Number(p?.costPence) || 0)),
        donatedBy: String(p?.donatedBy ?? "").trim() || undefined,
        imageUrl: String(p?.imageUrl ?? "").trim() || undefined,
      }))
      .filter((p) => p.title)
      .map((p, i) => ({ ...p, rank: i + 1 }));
  } catch {
    return [];
  }
}

type ParsedRaffle = Omit<typeof raffles.$inferInsert, "id">;

function readRaffleForm(formData: FormData): { data?: ParsedRaffle; error?: string } {
  const title = String(formData.get("title") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || title);
  const ticketPricePence = poundsToPence(formData.get("ticketPrice"));
  const maxTickets = optionalInt(formData.get("maxTickets"));
  const maxPerOrder = optionalInt(formData.get("maxPerOrder")) ?? 50;
  const minAge = Number(formData.get("minAge")) === 18 ? 18 : 16;
  const salesOpenAt = ukInputToDate(String(formData.get("salesOpenAt") ?? ""));
  const salesCloseAt = ukInputToDate(String(formData.get("salesCloseAt") ?? ""));
  const drawAt = ukInputToDate(String(formData.get("drawAt") ?? ""));
  const causeGoalPence = poundsToPence(formData.get("causeGoal"));
  const claimDays = optionalInt(formData.get("claimDays")) ?? 14;
  const quickPicks = String(formData.get("quickPicks") ?? "")
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  let galleryImages: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("galleryImages") ?? "[]"));
    if (Array.isArray(parsed)) galleryImages = parsed.filter((u): u is string => typeof u === "string" && !!u);
  } catch {
    // ignore malformed gallery; treat as empty
  }

  if (!title) return { error: "Give the raffle a title." };
  if (!SLUG_RE.test(slug)) return { error: "The web address can only use lower-case letters, numbers and dashes." };
  if (ticketPricePence === null || Number.isNaN(ticketPricePence) || ticketPricePence < 50)
    return { error: "Set a ticket price of at least 50p." };
  if (maxTickets !== null && (Number.isNaN(maxTickets) || maxTickets < 1))
    return { error: "The ticket cap must be a whole number, or blank for no cap." };
  if (Number.isNaN(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > 500)
    return { error: "Max per order must be between 1 and 500." };
  if (!salesOpenAt || !salesCloseAt || !drawAt) return { error: "Set when sales open, when they close, and the draw time." };
  if (salesCloseAt <= salesOpenAt) return { error: "Sales must close after they open." };
  if (drawAt < salesCloseAt) return { error: "The draw can't be before sales close." };
  if (causeGoalPence !== null && Number.isNaN(causeGoalPence)) return { error: "The fundraising goal must be an amount in pounds." };
  if (Number.isNaN(claimDays) || claimDays < 1) return { error: "Claim days must be a whole number of days." };

  return {
    data: {
      title,
      slug,
      tagline: String(formData.get("tagline") ?? "").trim() || null,
      description: String(formData.get("description") ?? "{}") || "{}",
      heroImageUrl: String(formData.get("heroImageUrl") ?? "").trim() || null,
      galleryImages,
      prizes: parsePrizes(formData.get("prizes")),
      ticketPricePence,
      maxTickets,
      maxPerOrder,
      quickPicks: quickPicks.length ? quickPicks.slice(0, 6) : [1, 5, 10, 20],
      minAge,
      salesOpenAt,
      salesCloseAt,
      drawAt,
      liveStreamUrl: String(formData.get("liveStreamUrl") ?? "").trim() || null,
      causeTitle: String(formData.get("causeTitle") ?? "").trim() || null,
      causeGoalPence,
      claimInstructions: String(formData.get("claimInstructions") ?? "").trim() || null,
      claimDays,
      smallPrint: String(formData.get("smallPrint") ?? "").trim() || null,
      published: formData.get("published") === "on",
      featured: formData.get("featured") === "on",
    },
  };
}

async function slugTaken(slug: string, exceptId?: string) {
  const rows = await db
    .select({ id: raffles.id })
    .from(raffles)
    .where(exceptId ? and(eq(raffles.slug, slug), ne(raffles.id, exceptId)) : eq(raffles.slug, slug))
    .limit(1);
  return rows.length > 0;
}

// Only one raffle is promoted across the site at a time.
async function clearOtherFeatured(id: string) {
  await db.update(raffles).set({ featured: false }).where(and(eq(raffles.featured, true), ne(raffles.id, id)));
}

function revalidateRaffles(slug?: string) {
  revalidatePath("/admin/raffles");
  revalidatePath("/raffles");
  if (slug) revalidatePath(`/raffles/${slug}`);
}

export async function getRaffleList() {
  await requireStaff();
  const rows = await db
    .select({
      raffle: raffles,
      sold: sql<number>`coalesce((select sum(quantity) from ${raffleOrders} o where o.raffle_id = ${raffles.id} and o.status = 'paid'), 0)::int`,
      raised: sql<number>`coalesce((select sum(amount - refunded_amount) from ${raffleOrders} o where o.raffle_id = ${raffles.id} and o.status in ('paid', 'refunded')), 0)::int`,
      drawPublished: sql<boolean>`exists (select 1 from ${raffleDraws} d where d.raffle_id = ${raffles.id} and d.published_at is not null)`,
    })
    .from(raffles)
    .orderBy(desc(raffles.drawAt));
  return rows.map((row) => ({ ...row.raffle, sold: Number(row.sold), raised: Number(row.raised), drawPublished: row.drawPublished }));
}

export async function getRaffleForAdmin(id: string) {
  await requireStaff();
  const [row] = await db.select().from(raffles).where(eq(raffles.id, id)).limit(1);
  return row ?? null;
}

export async function createRaffle(_prev: RaffleFormState, formData: FormData): Promise<RaffleFormState> {
  const session = await requireStaff();
  const { data, error } = readRaffleForm(formData);
  if (!data) return { error: error ?? "Check the form and try again." };
  if (await slugTaken(data.slug)) return { error: `The web address /raffles/${data.slug} is already used.` };

  const [row] = await db
    .insert(raffles)
    .values({ ...data, createdBy: session.user?.id ?? null })
    .returning({ id: raffles.id });
  if (data.featured) await clearOtherFeatured(row.id);

  await logAudit({ action: "create", entity: "raffle", entityId: row.id, description: `Created raffle "${data.title}"` });
  revalidateRaffles(data.slug);
  redirect(`/admin/raffles/${row.id}`);
}

export async function updateRaffle(id: string, _prev: RaffleFormState, formData: FormData): Promise<RaffleFormState> {
  await requireStaff();
  const [current] = await db.select().from(raffles).where(eq(raffles.id, id)).limit(1);
  if (!current) return { error: "That raffle no longer exists." };

  const { data, error } = readRaffleForm(formData);
  if (!data) return { error: error ?? "Check the form and try again." };
  if (await slugTaken(data.slug, id)) return { error: `The web address /raffles/${data.slug} is already used.` };

  // Once tickets are sold, every ticket must stay the same price, and the cap
  // can't drop below what is already sold or held.
  const started = current.ticketsReserved > 0 || current.ticketsIssued > 0;
  if (started && data.ticketPricePence !== current.ticketPricePence)
    return { error: "Tickets have already been sold, so the price can't change. Every ticket must cost the same." };
  if (data.maxTickets != null && data.maxTickets < current.ticketsReserved)
    return { error: `${current.ticketsReserved} tickets are already sold or held, so the cap can't be lower than that.` };

  await db.update(raffles).set({ ...data, updatedAt: new Date() }).where(eq(raffles.id, id));
  if (data.featured) await clearOtherFeatured(id);

  await logAudit({ action: "update", entity: "raffle", entityId: id, description: `Updated raffle "${data.title}"` });
  revalidateRaffles(data.slug);
  if (current.slug !== data.slug) revalidatePath(`/raffles/${current.slug}`);
  redirect(`/admin/raffles/${id}`);
}

/**
 * Copies a raffle as a new draft: same price, cap, settings and small print,
 * dates moved on a month, prizes cleared (they change every time).
 */
export async function duplicateRaffle(id: string) {
  const session = await requireStaff();
  const [source] = await db.select().from(raffles).where(eq(raffles.id, id)).limit(1);
  if (!source) throw new Error("Raffle not found");

  const salesOpenAt = addMonths(source.salesOpenAt, 1);
  let slug = `${source.slug}-copy`;
  for (let n = 2; await slugTaken(slug); n++) slug = `${source.slug}-copy-${n}`;

  const [row] = await db
    .insert(raffles)
    .values({
      slug,
      title: `${source.title} (copy)`,
      tagline: null,
      description: "{}",
      heroImageUrl: null,
      galleryImages: [],
      prizes: [],
      ticketPricePence: source.ticketPricePence,
      maxTickets: source.maxTickets,
      maxPerOrder: source.maxPerOrder,
      quickPicks: source.quickPicks,
      minAge: source.minAge,
      salesOpenAt: salesOpenAt,
      salesCloseAt: addMonths(source.salesCloseAt, 1),
      drawAt: addMonths(source.drawAt, 1),
      liveStreamUrl: source.liveStreamUrl,
      causeTitle: source.causeTitle,
      causeGoalPence: source.causeGoalPence,
      claimInstructions: source.claimInstructions,
      claimDays: source.claimDays,
      smallPrint: source.smallPrint,
      published: false,
      featured: false,
      createdBy: session.user?.id ?? null,
    })
    .returning({ id: raffles.id });

  await logAudit({ action: "create", entity: "raffle", entityId: row.id, description: `Duplicated raffle "${source.title}"` });
  revalidatePath("/admin/raffles");
  redirect(`/admin/raffles/${row.id}/edit`);
}

export async function duplicateLatestRaffle() {
  await requireStaff();
  const [latest] = await db.select({ id: raffles.id }).from(raffles).orderBy(desc(raffles.createdAt)).limit(1);
  if (!latest) redirect("/admin/raffles/new");
  await duplicateRaffle(latest.id);
}
