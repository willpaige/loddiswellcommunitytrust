"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Trophy,
  RotateCcw,
  Save,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  drawRandomWinners,
  type DrawWinner,
} from "@/actions/lottery-admin";
import { createDraw } from "@/actions/lottery-draws";

type PrizeRow = { prize: string };
type DrawnRow = { rank: number; winner: string; prize: string; ticketNumber?: number };

function todayDateInput(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function RandomDrawForm() {
  const router = useRouter();
  const [drawDate, setDrawDate] = useState(todayDateInput());
  const [prizes, setPrizes] = useState<PrizeRow[]>([
    { prize: "£50" },
    { prize: "£30" },
    { prize: "£20" },
  ]);
  const [drawn, setDrawn] = useState<DrawnRow[] | null>(null);
  const [poolInfo, setPoolInfo] = useState<{
    totalEntries: number;
    uniqueSubscribers: number;
  } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePrize(i: number, value: string) {
    setPrizes((prev) =>
      prev.map((p, idx) => (idx === i ? { prize: value } : p))
    );
  }

  function addPrize() {
    if (prizes.length >= 5) return;
    setPrizes((prev) => [...prev, { prize: "" }]);
  }

  function removePrize(i: number) {
    setPrizes((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleDraw() {
    setError(null);
    setDrawing(true);
    try {
      const result = await drawRandomWinners(prizes.length);
      const winners = result.winners as DrawWinner[];
      const rows: DrawnRow[] = winners.map((w, i) => ({
        rank: i + 1,
        winner: w.name,
        ticketNumber: w.ticketNumber,
        prize: prizes[i]?.prize ?? "",
      }));
      setDrawn(rows);
      setPoolInfo({
        totalEntries: result.totalEntries,
        uniqueSubscribers: result.uniqueSubscribers,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draw failed");
    } finally {
      setDrawing(false);
    }
  }

  function updateDrawnWinner(i: number, value: string) {
    setDrawn((prev) =>
      prev ? prev.map((r, idx) => (idx === i ? { ...r, winner: value } : r)) : prev
    );
  }

  async function handleSave() {
    if (!drawn || drawn.length === 0) return;
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("drawDate", drawDate);
    formData.set("results", JSON.stringify(drawn));
    formData.set("notes", "");
    formData.set("published", "on");
    try {
      await createDraw(formData);
      router.push("/admin/lottery");
    } catch (e) {
      // createDraw redirects on success — re-throw the redirect signal so Next handles it
      setSaving(false);
      throw e;
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Draw setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="drawDate">Draw date *</Label>
            <Input
              type="date"
              id="drawDate"
              value={drawDate}
              onChange={(e) => setDrawDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Prizes</Label>
            <div className="space-y-2">
              {prizes.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[3.5rem_1fr_auto] gap-2 items-center"
                >
                  <span className="text-sm font-semibold text-copper-600">
                    {ordinal(i + 1)}
                  </span>
                  <Input
                    value={p.prize}
                    placeholder="£50"
                    onChange={(e) => updatePrize(i, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePrize(i)}
                    disabled={prizes.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            {prizes.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPrize}
              >
                Add prize
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={handleDraw}
              disabled={drawing || prizes.length === 0}
              className="bg-copper-500 hover:bg-copper-600 text-white"
            >
              {drawing ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Drawing...
                </>
              ) : (
                <>
                  <Trophy className="h-4 w-4" aria-hidden="true" />
                  {drawn ? "Re-draw" : "Draw winners"}
                </>
              )}
            </Button>
            {drawn && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDraw}
                disabled={drawing}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {drawn && (
        <Card>
          <CardHeader>
            <CardTitle>Winners</CardTitle>
            {poolInfo && (
              <p className="text-xs text-muted-foreground">
                Drawn from {poolInfo.totalEntries} ticket
                {poolInfo.totalEntries === 1 ? "" : "s"} held by{" "}
                {poolInfo.uniqueSubscribers} subscriber
                {poolInfo.uniqueSubscribers === 1 ? "" : "s"}.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {drawn.length < prizes.length && (
              <p className="text-xs text-copper-700">
                Only {drawn.length} unique subscriber
                {drawn.length === 1 ? "" : "s"} could be drawn — fewer winners
                than prizes. Consider re-drawing or removing prizes.
              </p>
            )}
            <ul className="divide-y divide-border">
              {drawn.map((r, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[3.5rem_1fr_8rem] items-center gap-3 py-3"
                >
                  <span className="text-sm font-semibold text-copper-600">
                    {ordinal(r.rank)}
                  </span>
                  <Input
                    value={r.ticketNumber ? `${r.winner} (#${r.ticketNumber})` : r.winner}
                    onChange={(e) => updateDrawnWinner(i, e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">{r.prize}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save draw
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Saves as a published draw. You can email subscribers from the
                draw&apos;s edit page.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
