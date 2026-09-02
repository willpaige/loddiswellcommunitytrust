"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/admin/delete-button";
import { CancelSubscriptionButton } from "@/components/admin/cancel-subscription-button";
import { deleteManualSubscriber } from "@/actions/lottery-admin";
import {
  adminUpdateTicketHolders,
  type TicketHolder,
} from "@/actions/lottery-ticket-holders";
import { TicketHoldersDialog } from "@/components/lottery/ticket-holders-dialog";

export type SubscriberRow = {
  id: string;
  name: string;
  email: string;
  quantity: number;
  source: string;
  planLabel: string;
  planKey: string;
  renews: string;
  cancelAtPeriodEnd: boolean;
  status: string;
  canCancel: boolean;
  holders: TicketHolder[];
};

function holderNames(row: SubscriberRow) {
  const names = row.holders
    .map((h) => h.holderName)
    .filter((n): n is string => Boolean(n));
  return Array.from(new Set(names));
}

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  past_due: "destructive",
  canceled: "secondary",
  expired: "secondary",
  refunded: "outline",
};

const statusLabel: Record<string, string> = {
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  expired: "Expired",
  refunded: "Refunded",
};

type Props = {
  rows: SubscriberRow[];
};

export function LotterySubscribersTable({ rows }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");

  const statuses = useMemo(() => {
    const present = new Set(rows.map((r) => r.status));
    return Array.from(present).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (plan !== "all" && r.planKey !== plan) return false;
      if (
        q &&
        !r.name.toLowerCase().includes(q) &&
        !r.email.toLowerCase().includes(q) &&
        !holderNames(r).some((n) => n.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [rows, query, status, plan]);

  const filtersActive = query.trim() !== "" || status !== "all" || plan !== "all";

  return (
    <>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search by name, ticket holder or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Search subscribers"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger className="w-[140px]" aria-label="Filter by plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setPlan("all");
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>

      {filtersActive && (
        <CardContent className="pt-0 pb-2 text-sm text-muted-foreground">
          Showing {filtered.length} of {rows.length} subscriber
          {rows.length === 1 ? "" : "s"}
        </CardContent>
      )}

      {filtered.length === 0 ? (
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No subscribers match your search.
        </CardContent>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="hidden md:table-cell">Renews</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  {t.name}
                  {holderNames(t).length > 0 && (
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                      Holders: {holderNames(t).join(", ")}
                    </p>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {t.email}
                </TableCell>
                <TableCell>{t.quantity}</TableCell>
                <TableCell>
                  <Badge
                    variant={t.source === "manual" ? "outline" : "secondary"}
                  >
                    {t.planLabel}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {t.renews}
                  {t.cancelAtPeriodEnd && (
                    <p className="text-xs text-copper-600">Cancels {t.renews}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[t.status] ?? "outline"}>
                    {statusLabel[t.status] ?? t.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <TicketHoldersDialog
                      ticketId={t.id}
                      payerName={t.name}
                      holders={t.holders}
                      action={adminUpdateTicketHolders}
                      triggerVariant="icon"
                      triggerLabel="Ticket holders"
                    />
                    {t.source === "manual" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8"
                        >
                          <Link
                            href={`/admin/lottery/manual/${t.id}/edit`}
                            title="Edit subscriber"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </Button>
                        <DeleteButton
                          id={t.id}
                          action={deleteManualSubscriber}
                          label="Delete subscriber"
                        />
                      </>
                    ) : (
                      t.canCancel && (
                        <CancelSubscriptionButton
                          id={t.id}
                          subscriberLabel={t.name}
                          periodEnd={t.renews !== "—" ? t.renews : undefined}
                        />
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
