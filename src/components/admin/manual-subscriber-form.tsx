"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Props = {
  action: (formData: FormData) => Promise<void>;
  initialData?: {
    name: string;
    email: string;
    phone: string | null;
    quantity: number;
    notes: string | null;
    expiryDate: Date;
  };
};

function dateInputValue(d: Date | undefined): string {
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ManualSubscriberForm({ action, initialData }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
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
          <CardTitle>Subscriber details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={initialData?.name ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                name="email"
                required
                defaultValue={initialData?.email ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={initialData?.phone ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Tickets</Label>
              <Input
                id="quantity"
                type="number"
                name="quantity"
                min={1}
                max={50}
                defaultValue={initialData?.quantity ?? 1}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryDate">Expiry date</Label>
            <Input
              id="expiryDate"
              type="date"
              name="expiryDate"
              defaultValue={dateInputValue(initialData?.expiryDate)}
            />
            <p className="text-xs text-muted-foreground">
              Subscription is treated as active until this date. Defaults to one
              year from today if blank.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={initialData?.notes ?? ""}
              placeholder="e.g., paid by cheque, May 2026"
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {initialData ? "Update subscriber" : "Add subscriber"}
        </Button>
      </div>
    </form>
  );
}
