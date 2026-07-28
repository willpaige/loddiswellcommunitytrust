"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AvailableSlot = {
  date: string;
  times: string[];
};

function dateFromKey(date: string) {
  return new Date(`${date}T00:00:00`);
}

export function AvailableDatePicker({
  slots,
  value,
  onChange,
  disabled = false,
}: {
  slots: AvailableSlot[];
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}) {
  const slotMap = useMemo(() => new Map(slots.map((slot) => [slot.date, slot])), [slots]);
  const availableDates = useMemo(() => slots.map((slot) => dateFromKey(slot.date)), [slots]);
  const selectedDate = value ? dateFromKey(value) : undefined;
  const firstAvailableMonth = availableDates[0] ? startOfMonth(availableDates[0]) : startOfMonth(new Date());
  const lastAvailableMonth = availableDates.at(-1)
    ? startOfMonth(availableDates.at(-1)!)
    : firstAvailableMonth;
  const [visibleMonth, setVisibleMonth] = useState(selectedDate ?? firstAvailableMonth);

  useEffect(() => {
    setVisibleMonth(selectedDate ?? firstAvailableMonth);
  }, [firstAvailableMonth.getTime(), selectedDate?.getTime()]);

  const monthStart = startOfMonth(visibleMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const canGoPrevious = monthStart.getTime() > firstAvailableMonth.getTime();
  const canGoNext = monthStart.getTime() < lastAvailableMonth.getTime();

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-background p-3 shadow-sm",
        disabled && "opacity-60"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
          disabled={disabled || !canGoPrevious}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="text-sm font-medium">{format(monthStart, "MMMM yyyy")}</div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
          disabled={disabled || !canGoNext}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          <div key={`${day}-${index}`} className="flex h-7 items-center justify-center">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const available = slotMap.has(dateKey);
          const selected = value === dateKey;
          const outsideMonth = !isSameMonth(day, monthStart);

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => {
                if (available) onChange(dateKey);
              }}
              disabled={disabled || !available}
              className={cn(
                "flex h-10 items-center justify-center rounded-md border text-sm transition",
                selected
                  ? "border-copper-600 bg-copper-600 text-white"
                  : "border-transparent bg-transparent",
                available && !selected && "hover:border-copper-300 hover:bg-copper-50",
                !available && "cursor-not-allowed text-muted-foreground/35",
                outsideMonth && !selected && "text-muted-foreground/25"
              )}
              aria-pressed={selected}
              aria-label={format(day, "EEEE d MMMM yyyy")}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
