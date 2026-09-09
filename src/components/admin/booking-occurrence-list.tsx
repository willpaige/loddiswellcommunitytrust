"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatBookingDate } from "@/lib/booking-time";
import { money } from "@/lib/bookings";
import { Badge } from "@/components/ui/badge";
import { BookingOccurrenceActions } from "@/components/admin/booking-occurrence-actions";

export type OccurrenceRow = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: string;
  allocatedAmount: number;
  refundStatus: string;
};

// A weekly booking can carry a year of sessions. Showing all of them buries the
// bookings either side of it, so the list stops at three and the rest are one
// click away. Anything that needs attention — a session awaiting a refund — is
// pulled into the visible three so it is never hidden behind the toggle.
const COLLAPSED_COUNT = 3;

export function BookingOccurrenceList({
  occurrences,
}: {
  occurrences: OccurrenceRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (occurrences.length === 0) return null;

  const needsAttention = occurrences.filter(
    (occurrence) => occurrence.refundStatus === "due"
  );
  const collapsed = [
    ...needsAttention,
    ...occurrences.filter((occurrence) => occurrence.refundStatus !== "due"),
  ].slice(0, COLLAPSED_COUNT);
  // Keep the visible few in date order even after pulling refunds forward.
  collapsed.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const visible = expanded ? occurrences : collapsed;
  const hidden = occurrences.length - visible.length;

  return (
    <div className="mt-2">
      <ul className="space-y-1 border-l-2 border-copper-200 pl-3">
        {visible.map((occurrence) => (
          <li key={occurrence.id} className="flex items-center gap-2 text-xs">
            <span
              className={
                occurrence.status === "cancelled"
                  ? "line-through text-muted-foreground"
                  : ""
              }
            >
              {formatBookingDate(occurrence.startDate, "d MMM, HH:mm")}–
              {formatBookingDate(occurrence.endDate, "HH:mm")}
              {occurrence.allocatedAmount > 0 &&
                ` · ${money(occurrence.allocatedAmount)}`}
            </span>
            {occurrence.refundStatus === "due" && (
              <Badge variant="destructive">Refund due</Badge>
            )}
            {occurrence.refundStatus === "refunded" && (
              <Badge variant="outline">Refunded</Badge>
            )}
            <BookingOccurrenceActions
              occurrenceId={occurrence.id}
              cancelled={occurrence.status === "cancelled"}
              refundDue={occurrence.refundStatus === "due"}
            />
          </li>
        ))}
      </ul>

      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-1.5 ml-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" aria-hidden="true" />
              Show fewer
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
              Show {hidden} more session{hidden === 1 ? "" : "s"}
            </>
          )}
        </button>
      )}
    </div>
  );
}
