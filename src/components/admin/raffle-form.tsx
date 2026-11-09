"use client";

import { startTransition, useActionState, useMemo, useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { ImageUploadInput } from "@/components/admin/image-upload-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RaffleFormState } from "@/actions/raffles";
import type { RafflePrize } from "@/lib/db/schema";
import { DEFAULT_RAFFLE_SMALL_PRINT } from "@/lib/raffles/small-print";

export type RaffleFormValues = {
  title: string;
  slug: string;
  tagline: string | null;
  description: string;
  heroImageUrl: string | null;
  galleryImages: string[];
  prizes: RafflePrize[];
  ticketPricePence: number;
  maxTickets: number | null;
  maxPerOrder: number;
  quickPicks: number[];
  minAge: number;
  salesOpenAt: string;
  salesCloseAt: string;
  drawAt: string;
  liveStreamUrl: string | null;
  causeTitle: string | null;
  causeGoalPence: number | null;
  claimInstructions: string | null;
  claimDays: number;
  smallPrint: string | null;
  published: boolean;
  featured: boolean;
};

type PrizeRow = { title: string; description: string; value: string; cost: string; donatedBy: string; imageUrl: string | null };

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const checkboxClass = "h-4 w-4 rounded border-input accent-[var(--primary)]";

function pounds(pence: number | null | undefined) {
  if (pence === null || pence === undefined) return "";
  return (pence / 100).toFixed(2);
}

function toPence(value: string) {
  const n = Number(value.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function RaffleForm({
  action,
  initial,
  ticketsSold = 0,
  submitLabel,
}: {
  action: (prev: RaffleFormState, formData: FormData) => Promise<RaffleFormState>;
  initial?: Partial<RaffleFormValues>;
  /** Locks the price once tickets are sold (every ticket must cost the same). */
  ticketsSold?: number;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [description, setDescription] = useState(initial?.description || "{}");
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(initial?.heroImageUrl ?? null);
  const [gallery, setGallery] = useState<(string | null)[]>(() => {
    const g: (string | null)[] = [...(initial?.galleryImages ?? [])];
    while (g.length < 3) g.push(null);
    return g.slice(0, 3);
  });
  const [prizes, setPrizes] = useState<PrizeRow[]>(() =>
    initial?.prizes?.length
      ? initial.prizes.map((p) => ({
          title: p.title,
          description: p.description ?? "",
          value: pounds(p.valuePence),
          cost: pounds(p.costPence),
          donatedBy: p.donatedBy ?? "",
          imageUrl: p.imageUrl ?? null,
        }))
      : [{ title: "", description: "", value: "", cost: "", donatedBy: "", imageUrl: null }]
  );
  const [price, setPrice] = useState(pounds(initial?.ticketPricePence) || "2.00");
  const [cap, setCap] = useState(initial?.maxTickets ? String(initial.maxTickets) : "");

  const capTotal = useMemo(() => {
    const capN = Number(cap);
    return capN > 0 ? capN * toPence(price) : null;
  }, [cap, price]);

  function updatePrize(i: number, patch: Partial<PrizeRow>) {
    setPrizes((rows) => rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function movePrize(i: number, by: -1 | 1) {
    setPrizes((rows) => {
      const next = [...rows];
      const j = i + by;
      if (j < 0 || j >= next.length) return rows;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // onSubmit rather than <form action>: React resets a form after an action,
  // which would wipe everything typed when validation fails.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("description", description);
    formData.set("heroImageUrl", heroImageUrl ?? "");
    formData.set("galleryImages", JSON.stringify(gallery.filter(Boolean)));
    formData.set(
      "prizes",
      JSON.stringify(
        prizes.map((p) => ({
          title: p.title,
          description: p.description,
          valuePence: toPence(p.value),
          costPence: toPence(p.cost),
          donatedBy: p.donatedBy,
          imageUrl: p.imageUrl,
        }))
      )
    );
    startTransition(() => formAction(formData));
  }

  const priceLocked = ticketsSold > 0;

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
      <div className="space-y-6 min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>1 · The basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" name="title" required defaultValue={initial?.title} placeholder="Win a wheelbarrow of booze" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Web address</Label>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span>/raffles/</span>
                  <Input id="slug" name="slug" defaultValue={initial?.slug} placeholder="november" />
                </div>
                <p className="text-xs text-muted-foreground">Leave blank to make one from the title.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">One-line pitch</Label>
              <Input id="tagline" name="tagline" defaultValue={initial?.tagline ?? ""} placeholder="Over £150 of beer, wine and spirits, donated by…" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor content={description} onChange={setDescription} />
            </div>
            <div className="space-y-2">
              <Label>Main photo</Label>
              <ImageUploadInput value={heroImageUrl} onChange={setHeroImageUrl} folder="raffles" />
            </div>
            <div className="space-y-2">
              <Label>More photos (optional)</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {gallery.map((url, i) => (
                  <ImageUploadInput
                    key={i}
                    value={url}
                    folder="raffles"
                    aspect="square"
                    onChange={(next) => setGallery((g) => g.map((u, idx) => (idx === i ? next : u)))}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2 · Prizes</CardTitle>
            <CardDescription>
              The order here is the order the draw runs in. Donated prizes cost £0, but record what they are
              worth for the council return.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {prizes.map((prize, i) => (
              <div key={i} className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{i + 1 === 1 ? "1st" : i + 1 === 2 ? "2nd" : i + 1 === 3 ? "3rd" : `${i + 1}th`} prize</p>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label="Move prize up" disabled={i === 0} onClick={() => movePrize(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Move prize down" disabled={i === prizes.length - 1} onClick={() => movePrize(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove prize" disabled={prizes.length === 1} onClick={() => setPrizes((rows) => rows.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`prize-${i}-title`}>Prize</Label>
                    <Input id={`prize-${i}-title`} value={prize.title} onChange={(e) => updatePrize(i, { title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`prize-${i}-donor`}>Donated by</Label>
                    <Input id={`prize-${i}-donor`} value={prize.donatedBy} onChange={(e) => updatePrize(i, { donatedBy: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`prize-${i}-value`}>Worth (£)</Label>
                    <Input id={`prize-${i}-value`} inputMode="decimal" value={prize.value} onChange={(e) => updatePrize(i, { value: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`prize-${i}-cost`}>Cost to the Trust (£)</Label>
                    <Input id={`prize-${i}-cost`} inputMode="decimal" value={prize.cost} placeholder="0.00" onChange={(e) => updatePrize(i, { cost: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`prize-${i}-desc`}>Short description</Label>
                  <Input id={`prize-${i}-desc`} value={prize.description} onChange={(e) => updatePrize(i, { description: e.target.value })} />
                </div>
                <div className="max-w-xs">
                  <ImageUploadInput value={prize.imageUrl} folder="raffles" aspect="square" onChange={(url) => updatePrize(i, { imageUrl: url })} />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setPrizes((rows) => [...rows, { title: "", description: "", value: "", cost: "", donatedBy: "", imageUrl: null }])}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add prize
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3 · Tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ticketPrice">Price per ticket (£) *</Label>
                <Input id="ticketPrice" name="ticketPrice" inputMode="decimal" required value={price} readOnly={priceLocked} onChange={(e) => setPrice(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  {priceLocked ? "Locked: tickets have been sold, and every ticket must cost the same." : "The same price for every ticket."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTickets">Ticket cap</Label>
                <Input id="maxTickets" name="maxTickets" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="No cap" />
                <p className="text-xs text-muted-foreground">Leave blank for unlimited.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPerOrder">Max per order</Label>
                <Input id="maxPerOrder" name="maxPerOrder" inputMode="numeric" defaultValue={initial?.maxPerOrder ?? 50} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quickPicks">Quick-pick tiles</Label>
                <Input id="quickPicks" name="quickPicks" defaultValue={(initial?.quickPicks ?? [1, 5, 10, 20]).join(", ")} />
                <p className="text-xs text-muted-foreground">Shortcuts on the ticket picker, not discounts.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minAge">Minimum age</Label>
                <select id="minAge" name="minAge" defaultValue={String(initial?.minAge ?? 18)} className={selectClass}>
                  <option value="16">16+ (standard lottery age)</option>
                  <option value="18">18+ (prize includes alcohol)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4 · Dates</CardTitle>
            <CardDescription>UK time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="salesOpenAt">Tickets on sale *</Label>
                <Input id="salesOpenAt" name="salesOpenAt" type="datetime-local" required defaultValue={initial?.salesOpenAt} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salesCloseAt">Sales close *</Label>
                <Input id="salesCloseAt" name="salesCloseAt" type="datetime-local" required defaultValue={initial?.salesCloseAt} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawAt">Draw *</Label>
                <Input id="drawAt" name="drawAt" type="datetime-local" required defaultValue={initial?.drawAt} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="liveStreamUrl">Live stream link (optional)</Label>
              <Input id="liveStreamUrl" name="liveStreamUrl" type="url" defaultValue={initial?.liveStreamUrl ?? ""} placeholder="https://facebook.com/…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5 · Cause, claiming and small print</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="causeTitle">What it's raising money for</Label>
                <Input id="causeTitle" name="causeTitle" defaultValue={initial?.causeTitle ?? ""} placeholder="The new pavilion roof" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="causeGoal">Fundraising goal (£, optional)</Label>
                <Input id="causeGoal" name="causeGoal" inputMode="decimal" defaultValue={pounds(initial?.causeGoalPence)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
              <div className="space-y-2">
                <Label htmlFor="claimInstructions">How winners claim</Label>
                <Textarea id="claimInstructions" name="claimInstructions" rows={3} defaultValue={initial?.claimInstructions ?? ""} placeholder="Reply to this email or call 07… to arrange collection from the Village Hall." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claimDays">Days to claim</Label>
                <Input id="claimDays" name="claimDays" inputMode="numeric" defaultValue={initial?.claimDays ?? 14} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="smallPrint">Small print</Label>
              <Textarea id="smallPrint" name="smallPrint" rows={4} defaultValue={initial?.smallPrint ?? DEFAULT_RAFFLE_SMALL_PRINT} />
              <p className="text-xs text-muted-foreground">
                {"{price}"} and {"{drawDate}"} are filled in automatically. Society lottery tickets must name the promoter, price and draw date.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle>Publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="published" defaultChecked={initial?.published ?? false} className={`${checkboxClass} mt-0.5`} />
              <span>Published (visible on the website from its sale date)</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="featured" defaultChecked={initial?.featured ?? true} className={`${checkboxClass} mt-0.5`} />
              <span>Feature on the homepage and site banner</span>
            </label>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {submitLabel}
            </Button>
            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </CardContent>
        </Card>
        {capTotal !== null && (
          <Card>
            <CardContent className="pt-6 text-sm space-y-1">
              <p className="font-semibold">If every ticket sells</p>
              <p>£{(capTotal / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })} in proceeds.</p>
              {capTotal > 2_000_000 && (
                <p role="alert" className="text-destructive">
                  That is over the £20,000 limit for one small society lottery. Lower the cap or price.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </form>
  );
}
