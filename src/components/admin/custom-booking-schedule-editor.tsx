"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { getAvailableBookingSlots, saveCustomBookingOccurrence } from "@/actions/bookings";
import { AvailableDatePicker } from "@/components/booking/available-date-picker";
import { AvailableTimePicker } from "@/components/booking/available-time-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Occurrence = { id: string; startDate: Date; endDate: Date; status: string };
type Slot = { date: string; times: string[]; endTimesByStart?: Record<string, string[]> };

export function CustomBookingScheduleEditor({
  bookingId,
  offeringId,
  bookableStartTime,
  bookableEndTime,
  occurrences,
}: {
  bookingId: string;
  offeringId: string;
  bookableStartTime?: string;
  bookableEndTime?: string;
  occurrences: Occurrence[];
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [occurrenceId, setOccurrenceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedSlot = slots.find((slot) => slot.date === date);
  const times = useMemo(() => {
    const current = occurrenceId ? [time] : [];
    return Array.from(new Set([...(selectedSlot?.times ?? []), ...current].filter(Boolean))).sort();
  }, [occurrenceId, selectedSlot?.times, time]);
  const endTimes = useMemo(() => {
    const current = occurrenceId ? [endTime] : [];
    return Array.from(new Set([...(selectedSlot?.endTimesByStart?.[time] ?? []), ...current].filter(Boolean))).sort();
  }, [endTime, occurrenceId, selectedSlot?.endTimesByStart, time]);

  useEffect(() => {
    getAvailableBookingSlots(offeringId).then((next) => {
      setSlots(next);
      const first = next[0];
      const firstTime = first?.times[0] ?? "";
      setDate(first?.date ?? "");
      setTime(firstTime);
      setEndTime(first?.endTimesByStart?.[firstTime]?.[0] ?? "");
    });
  }, [offeringId]);

  function reset() {
    setOccurrenceId("");
    const first = slots[0];
    const firstTime = first?.times[0] ?? "";
    setDate(first?.date ?? "");
    setTime(firstTime);
    setEndTime(first?.endTimesByStart?.[firstTime]?.[0] ?? "");
  }

  async function submit(formData: FormData) {
    setSaving(true);
    try {
      await saveCustomBookingOccurrence(formData);
      reset();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form action={submit} className="mt-5 grid gap-3 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="occurrenceId" value={occurrenceId} />
      <input type="hidden" name="date" value={date} />
      <div className="space-y-2 sm:col-span-2">
        <Label>{occurrenceId ? "Reschedule session" : "Add session"}</Label>
        <AvailableDatePicker
          slots={slots}
          value={date}
          onChange={(nextDate) => {
            const slot = slots.find((item) => item.date === nextDate);
            const nextTime = slot?.times[0] ?? "";
            setDate(nextDate);
            setTime(nextTime);
            setEndTime(slot?.endTimesByStart?.[nextTime]?.[0] ?? "");
          }}
        />
      </div>
      <div className="space-y-2">
        <Label>Start time</Label>
        <AvailableTimePicker name="time" value={time} availableTimes={times} startTime={bookableStartTime ?? "08:00"} endTime={bookableEndTime ?? "23:00"} onChange={setTime} />
      </div>
      <div className="space-y-2">
        <Label>End time</Label>
        <AvailableTimePicker name="endTime" value={endTime} availableTimes={endTimes} startTime={time || bookableStartTime || "08:00"} endTime={bookableEndTime ?? "23:00"} onChange={setEndTime} />
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" disabled={saving || !date || !time || !endTime}>
          {saving ? "Saving..." : occurrenceId ? "Save new time" : "Add session"}
        </Button>
        {occurrenceId && <Button type="button" variant="outline" onClick={reset}>Cancel edit</Button>}
      </div>
      <div className="sm:col-span-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Edit an active session</p>
        <div className="flex flex-wrap gap-2">
          {occurrences.filter((item) => item.status !== "cancelled").map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setOccurrenceId(item.id);
                setDate(format(item.startDate, "yyyy-MM-dd"));
                setTime(format(item.startDate, "HH:mm"));
                setEndTime(format(item.endDate, "HH:mm"));
              }}
            >
              {format(item.startDate, "d MMM, HH:mm")}
            </Button>
          ))}
        </div>
      </div>
    </form>
  );
}
