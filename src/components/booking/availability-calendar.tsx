"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { Plus } from "lucide-react";
import { ManualBookingDialog } from "@/components/admin/manual-booking-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type AvailabilityCalendarItem = {
  id: string;
  title: string;
  facilityName: string;
  startDate: Date;
  endDate: Date;
  status: string;
  // Units of the venue's capacity a block closes; null/absent means all of them.
  // Optional because the public availability feed carries no blocks at all.
  capacity?: number | null;
  type: "booking" | "block" | "event";
};

type ManualBookingOffering = {
  offeringId: string;
  offeringName: string;
  facilityName: string;
  facilityBookableStartTime?: string;
  facilityBookableEndTime?: string;
};

type ManualBookingPrice = {
  offeringId: string;
  customerGroup: string;
  amount: number;
  variableDuration: boolean;
};

export function AvailabilityCalendar({
  items,
  manualBookingOfferings = [],
  manualBookingPrices = [],
  repeatDiscount,
  month = new Date(),
  title,
  description,
  publicBookingHref,
}: {
  items: AvailabilityCalendarItem[];
  manualBookingOfferings?: ManualBookingOffering[];
  manualBookingPrices?: ManualBookingPrice[];
  repeatDiscount?: { threshold: number; percent: number };
  month?: Date;
  title?: string;
  description?: string;
  publicBookingHref?: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const monthStart = startOfMonth(month);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <Card>
      <ManualBookingDialog
        offerings={manualBookingOfferings}
        prices={manualBookingPrices}
        repeatDiscount={repeatDiscount}
        open={manualBookingOpen}
        onOpenChange={setManualBookingOpen}
        defaultDate={selectedDate}
        showTrigger={false}
      />
      <CardHeader>
        <CardTitle>{title || format(monthStart, "MMMM yyyy")}</CardTitle>
        <CardDescription>
          {description || "Confirmed bookings and blocked-out venue times."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 border-l border-t text-xs font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="border-b border-r p-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-l">
          {days.map((day) => {
            const dayItems = items.filter((item) => isSameDay(item.startDate, day));
            const outsideMonth = day.getMonth() !== monthStart.getMonth();
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  if (manualBookingOfferings.length > 0) {
                    setSelectedDate(day);
                    setManualBookingOpen(true);
                    return;
                  }
                  if (publicBookingHref) {
                    router.push(`${publicBookingHref}?date=${format(day, "yyyy-MM-dd")}`);
                  }
                }}
                className="group min-h-32 border-b border-r p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={
                  manualBookingOfferings.length > 0 || publicBookingHref
                    ? `Add booking on ${format(day, "d MMMM yyyy")}`
                    : format(day, "d MMMM yyyy")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={outsideMonth ? "text-muted-foreground/50" : ""}>
                    {format(day, "d")}
                  </span>
                  {(manualBookingOfferings.length > 0 || publicBookingHref) && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-background group-hover:opacity-100">
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  {dayItems.slice(0, 4).map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="rounded-md border bg-background p-2 text-xs leading-tight"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{item.facilityName}</span>
                        <Badge
                          variant={item.type === "block" ? "outline" : "secondary"}
                          className="px-1.5"
                        >
                          {item.type === "block"
                            ? item.capacity
                              ? `Block ×${item.capacity}`
                              : "Block"
                            : item.type === "event"
                              ? "Event"
                              : item.status}
                        </Badge>
                      </div>
                      <div className="mt-1 truncate text-muted-foreground">
                        {format(item.startDate, "HH:mm")} - {format(item.endDate, "HH:mm")} · {item.title}
                      </div>
                    </div>
                  ))}
                  {dayItems.length > 4 && (
                    <p className="text-xs text-muted-foreground">
                      +{dayItems.length - 4} more
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
