"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { formatBookingDate } from "@/lib/booking-time";
import {
  deleteNewsletterSubscriber,
  setNewsletterSubscriberStatus,
} from "@/actions/newsletter-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/admin/delete-button";

export type NewsletterRow = {
  id: string;
  email: string;
  status: "active" | "unsubscribed";
  createdAt: Date;
};

function StatusToggle({ row }: { row: NewsletterRow }) {
  const [pending, startTransition] = useTransition();
  const next = row.status === "active" ? "unsubscribed" : "active";
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => setNewsletterSubscriberStatus(row.id, next))}
      aria-label={`${next === "active" ? "Reactivate" : "Unsubscribe"} ${row.email}`}
    >
      {pending ? "Saving…" : next === "active" ? "Reactivate" : "Unsubscribe"}
    </Button>
  );
}

export function NewsletterSubscribersTable({ rows }: { rows: NewsletterRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (q && !row.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, status]);

  const filtersActive = query.trim() !== "" || status !== "all";

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
            placeholder="Search by email..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            aria-label="Search subscribers"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            </SelectContent>
          </Select>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatus("all");
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
          Showing {filtered.length} of {rows.length}
        </CardContent>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden sm:table-cell">Signed up</TableHead>
            <TableHead className="pr-6 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                {rows.length === 0 ? "No one has signed up yet." : "No subscribers match these filters."}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pl-6 font-medium">{row.email}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "default" : "secondary"}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {formatBookingDate(row.createdAt, "d MMM yyyy")}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <StatusToggle row={row} />
                    <DeleteButton
                      id={row.id}
                      action={deleteNewsletterSubscriber}
                      label={`Delete ${row.email}`}
                      description="This removes the address from the list entirely. Use Unsubscribe instead if they have simply opted out, so a later signup doesn't re-add them by mistake."
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
