"use client";

import { useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  startOfDay,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { bookingDateKey, formatBookingDate } from "@/lib/booking-time";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ManualBookingDialog } from "@/components/admin/manual-booking-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type AvailabilityCalendarItem = {
  id: string;
  title: string;
  facilityName: string;
  startDate: Date;
  endDate: Date;
  status: string;
  type: "booking" | "block" | "event";
  href?: string;
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

function itemTimeLabel(item: AvailabilityCalendarItem) {
  const start = formatBookingDate(item.startDate, "HH:mm");
  // Events saved without an end time come through with endDate = startDate.
  if (item.endDate.getTime() <= item.startDate.getTime()) return start;
  return `${start} – ${formatBookingDate(item.endDate, "HH:mm")}`;
}

function itemBadgeLabel(item: AvailabilityCalendarItem) {
  if (item.type === "block") return "Block";
  if (item.type === "event") return "Event";
  return item.status;
}

export function AvailabilityCalendar({
  items,
  manualBookingOfferings = [],
  manualBookingPrices = [],
  repeatDiscount,
  month = new Date(),
  minMonth,
  maxMonth,
  title,
  description,
  publicBookingHref,
}: {
  items: AvailabilityCalendarItem[];
  manualBookingOfferings?: ManualBookingOffering[];
  manualBookingPrices?: ManualBookingPrice[];
  repeatDiscount?: { threshold: number; percent: number };
  month?: Date;
  minMonth?: Date;
  maxMonth?: Date;
  title?: string;
  description?: string;
  publicBookingHref?: string;
}) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(month));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [manualBookingOpen, setManualBookingOpen] = useState(false);
  const isAdmin = manualBookingOfferings.length > 0;
  const calendarStart = startOfWeek(viewMonth, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const canGoBack = !minMonth || viewMonth > startOfMonth(minMonth);
  const canGoForward = !maxMonth || viewMonth < startOfMonth(maxMonth);

  const itemsOn = (dayKey: string) =>
    items
      .filter((item) => bookingDateKey(item.startDate) === dayKey)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined;
  const selectedItems = selectedKey ? itemsOn(selectedKey) : [];
  const selectedIsPast = selectedDate
    ? isBefore(selectedDate, startOfDay(new Date()))
    : false;

  function changeMonth(offset: number) {
    setViewMonth((current) => addMonths(current, offset));
    if (!isAdmin) setSelectedDate(undefined);
  }

  return (
    <Card>
      {isAdmin && (
        <ManualBookingDialog
          offerings={manualBookingOfferings}
          prices={manualBookingPrices}
          repeatDiscount={repeatDiscount}
          open={manualBookingOpen}
          onOpenChange={setManualBookingOpen}
          defaultDate={selectedDate}
          showTrigger={false}
        />
      )}
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>{title || "Calendar"}</CardTitle>
            <CardDescription className="mt-1.5">
              {description || "Confirmed bookings and blocked-out venue times."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => changeMonth(-1)}
              disabled={!canGoBack}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p
              className="min-w-36 text-center font-serif text-lg text-foreground"
              aria-live="polite"
            >
              {format(viewMonth, "MMMM yyyy")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => changeMonth(1)}
              disabled={!canGoForward}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 border-l border-t text-xs font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="border-b border-r p-1.5 text-center sm:p-2 sm:text-left">
              <span className="sm:hidden">{day.charAt(0)}</span>
              <span className="hidden sm:inline">{day}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-l">
          {days.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayItems = itemsOn(dayKey);
            const outsideMonth = day.getMonth() !== viewMonth.getMonth();
            const isToday = dayKey === todayKey;
            const isSelected = !isAdmin && dayKey === selectedKey;
            const hasEvent = dayItems.some((item) => item.type === "event");
            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => {
                  setSelectedDate(day);
                  if (isAdmin) setManualBookingOpen(true);
                }}
                className={`group flex min-h-14 flex-col justify-start border-b border-r p-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-32 sm:p-2 ${
                  isSelected ? "bg-copper-50 hover:bg-copper-50" : ""
                }`}
                aria-pressed={isAdmin ? undefined : isSelected}
                aria-label={`${format(day, "EEEE d MMMM yyyy")}${
                  dayItems.length > 0
                    ? `, ${dayItems.length} ${dayItems.length === 1 ? "entry" : "entries"}`
                    : ""
                }${isAdmin ? ", add booking" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs sm:text-sm ${
                      isToday
                        ? "bg-copper-500 font-semibold text-white"
                        : outsideMonth
                          ? "text-muted-foreground/50"
                          : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {isAdmin && (
                    <span className="hidden h-6 w-6 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-background group-hover:opacity-100 sm:flex">
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  )}
                </div>

                {dayItems.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 sm:hidden" aria-hidden="true">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${hasEvent ? "bg-copper-500" : "bg-sage-500"}`}
                    />
                    {dayItems.length > 1 && (
                      <span className="text-[10px] leading-none text-muted-foreground">
                        {dayItems.length}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-2 hidden space-y-1 sm:block">
                  {dayItems.slice(0, 3).map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className={`rounded-md border p-2 text-xs leading-tight ${
                        item.type === "event"
                          ? "border-copper-200 bg-copper-50"
                          : "bg-background"
                      }`}
                    >
                      {item.type === "event" ? (
                        <p className="line-clamp-2 font-medium">{item.title}</p>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{item.facilityName}</span>
                          <Badge
                            variant={item.type === "block" ? "outline" : "secondary"}
                            className="px-1.5"
                          >
                            {itemBadgeLabel(item)}
                          </Badge>
                        </div>
                      )}
                      <div className="mt-1 truncate text-muted-foreground">
                        {itemTimeLabel(item)} ·{" "}
                        {item.type === "event" ? item.facilityName : item.title}
                      </div>
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{dayItems.length - 3} more
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!isAdmin && (
          <div className="mt-6 rounded-lg border bg-background p-5" aria-live="polite">
            {selectedDate ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-serif text-lg text-foreground">
                    {format(selectedDate, "EEEE d MMMM yyyy")}
                  </h3>
                  {publicBookingHref && !selectedIsPast && (
                    <Link
                      href={`${publicBookingHref}?date=${selectedKey}`}
                      className="inline-flex items-center justify-center rounded-lg bg-copper-500 px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-copper-600"
                    >
                      Book a venue on this date
                    </Link>
                  )}
                </div>
                {selectedItems.length > 0 ? (
                  <ul className="mt-4 divide-y divide-border">
                    {selectedItems.map((item) => (
                      <li
                        key={`${item.type}-${item.id}`}
                        className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {item.type === "event" ? item.title : item.facilityName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {itemTimeLabel(item)} ·{" "}
                            {item.type === "event" ? item.facilityName : item.title}
                          </p>
                        </div>
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="text-sm font-medium text-copper-600 underline-offset-4 hover:underline"
                          >
                            View details
                          </Link>
                        ) : (
                          <Badge variant="secondary" className="w-fit">
                            {itemBadgeLabel(item)}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nothing is on this day yet.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a day to see what&rsquo;s on
                {publicBookingHref ? " or to start a booking" : ""}.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
