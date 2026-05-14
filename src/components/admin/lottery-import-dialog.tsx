"use client";

import { useState } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  importLotterySubscribers,
  type ImportResult,
} from "@/actions/lottery-admin";
import { useRouter } from "next/navigation";

export function LotteryImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setLoading(false);
    setResult(null);
    setError(null);
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const r = await importLotterySubscribers(formData);
      setResult(r);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4" aria-hidden="true" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import subscribers from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV exported from your spreadsheet. Existing manual rows
            with matching emails will be skipped (re-imports are safe).
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2
                  className="h-5 w-5 text-sage-600"
                  aria-hidden="true"
                />
                <p className="font-medium">Import complete</p>
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <strong className="text-foreground">{result.inserted}</strong>{" "}
                  inserted
                </li>
                <li>
                  <strong className="text-foreground">{result.skipped}</strong>{" "}
                  skipped (already exist)
                </li>
                <li>
                  <strong className="text-foreground">
                    {result.errors.length}
                  </strong>{" "}
                  errors
                </li>
              </ul>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-md border border-copper-200 bg-copper-50 p-4 text-sm">
                <p className="font-medium text-copper-800 mb-2">Errors</p>
                <ul className="space-y-1 text-copper-700 text-xs">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.reason}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>… {result.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">CSV format</p>
              <p>
                Header row required, columns:{" "}
                <code className="font-mono">name,email,phone,quantity,notes,expiryDate</code>
              </p>
              <p className="mt-1">
                <code className="font-mono">name</code>,{" "}
                <code className="font-mono">email</code>, and{" "}
                <code className="font-mono">quantity</code> are required;{" "}
                <code className="font-mono">expiryDate</code> uses{" "}
                <code className="font-mono">YYYY-MM-DD</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">CSV file</Label>
              <Input
                type="file"
                id="file"
                name="file"
                accept=".csv,text/csv"
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                Import
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
