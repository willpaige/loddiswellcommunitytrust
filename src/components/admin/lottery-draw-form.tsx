"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  KeyValueEditor,
  type KeyValuePair,
} from "@/components/admin/key-value-editor";

export type DrawResult = {
  rank: number;
  winner: string;
  prize: string;
};

type Props = {
  action: (formData: FormData) => Promise<void>;
  initialData?: {
    drawDate: Date;
    results: DrawResult[] | null;
    notes: string | null;
    published: boolean;
  };
};

function dateInputValue(d: Date | undefined): string {
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function LotteryDrawForm({ action, initialData }: Props) {
  const [results, setResults] = useState<KeyValuePair[]>(
    initialData?.results
      ? initialData.results.map((r) => ({ key: r.winner, value: r.prize }))
      : [
          { key: "", value: "" },
          { key: "", value: "" },
          { key: "", value: "" },
        ]
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    const payload: DrawResult[] = results
      .map((row, i) => ({
        rank: i + 1,
        winner: row.key.trim(),
        prize: row.value.trim(),
      }))
      .filter((r) => r.winner || r.prize);
    formData.set("results", JSON.stringify(payload));
    setLoading(true);
    try {
      await action(formData);
    } catch (e) {
      setLoading(false);
      throw e;
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Draw details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="drawDate">Draw date *</Label>
            <Input
              type="date"
              id="drawDate"
              name="drawDate"
              required
              defaultValue={dateInputValue(initialData?.drawDate)}
            />
            <p className="text-xs text-muted-foreground">
              The date the monthly draw was held.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Winners and prizes</Label>
            <KeyValueEditor
              value={results}
              onChange={setResults}
              keyLabel="Winner"
              valueLabel="Prize"
              keyPlaceholder="Jane Smith"
              valuePlaceholder="£50"
              addLabel="Add winner"
              emptyLabel="No winners yet. Add at least one."
            />
            <p className="text-xs text-muted-foreground">
              Order matters — the first row is the top prize.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={initialData?.notes ?? ""}
              placeholder="e.g., Drawn at the village hall AGM. Thanks to everyone who took part."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Checkbox
              id="published"
              name="published"
              defaultChecked={initialData?.published ?? true}
            />
            <Label htmlFor="published" className="font-normal">
              Published (visible on the public lottery page)
            </Label>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {initialData ? "Update draw" : "Save draw"}
        </Button>
      </div>
    </form>
  );
}
