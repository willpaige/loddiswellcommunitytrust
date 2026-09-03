"use client";

import { useEffect, useMemo, useState } from "react";
import { changeCustomerBooking, previewCustomerBookingChange } from "@/actions/bookings";
import { AvailableDatePicker } from "@/components/booking/available-date-picker";
import { AvailableTimePicker } from "@/components/booking/available-time-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { bookingDateKey, formatBookingDate } from "@/lib/booking-time";
import { keepBookingDuration, money } from "@/lib/bookings";

type AvailableSlot = {
  date: string;
  times: string[];
  endTimesByStart: Record<string, string[]>;
};

export function BookingChangeForm({
  booking,
  slots,
  bookableStartTime,
  bookableEndTime,
}: {
  booking: {
    id: string;
    facilityName: string;
    startDate: Date;
    endDate: Date;
    amount: number;
    paidAmount: number;
  };
  slots: AvailableSlot[];
  bookableStartTime: string;
  bookableEndTime: string;
}) {
  const currentDate = bookingDateKey(booking.startDate);
  const currentTime = formatBookingDate(booking.startDate, "HH:00");
  const currentEndTime = formatBookingDate(booking.endDate, "HH:00");

  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState(currentTime);
  const [endTime, setEndTime] = useState(currentEndTime);
  const [quote, setQuote] = useState<{ amount: number; balance: number } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const selectedSlot = slots.find((slot) => slot.date === date);
  // The booking's own hours come back as available, but merge the current
  // selection in anyway so the form can always show where it stands today.
  const availableTimes = useMemo(() => {
    const current = date === currentDate ? [currentTime] : [];
    return Array.from(new Set([...(selectedSlot?.times ?? []), ...current])).sort();
  }, [currentDate, currentTime, date, selectedSlot?.times]);
  const availableEndTimes = useMemo(() => {
    const current = date === currentDate && time === currentTime ? [currentEndTime] : [];
    return Array.from(
      new Set([...(selectedSlot?.endTimesByStart?.[time] ?? []), ...current])
    ).sort();
  }, [currentDate, currentEndTime, currentTime, date, selectedSlot?.endTimesByStart, time]);

  const unchanged = date === currentDate && time === currentTime && endTime === currentEndTime;

  useEffect(() => {
    if (unchanged || !date || !time || !endTime) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    previewCustomerBookingChange(booking.id, date, time, endTime)
      .then((next) => {
        if (cancelled) return;
        setQuote({ amount: next.amount, balance: next.balance });
        setQuoteError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(error instanceof Error ? error.message : "Could not price that change.");
      });
    return () => {
      cancelled = true;
    };
  }, [booking.id, date, endTime, time, unchanged]);

  return (
    <form action={changeCustomerBooking} className="space-y-6">
      <input type="hidden" name="bookingId" value={booking.id} />

      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium">Booked now</p>
        <p className="mt-1 text-muted-foreground">
          {booking.facilityName} · {formatBookingDate(booking.startDate, "EEEE d MMMM yyyy, HH:mm")}–
          {formatBookingDate(booking.endDate, "HH:mm")} · {money(booking.amount)}
        </p>
      </div>

      <div className="space-y-2">
        <Label>New date</Label>
        <AvailableDatePicker
          slots={slots}
          value={date}
          onChange={(nextDate) => {
            const nextSlot = slots.find((slot) => slot.date === nextDate);
            const nextTime = nextSlot?.times.includes(time) ? time : nextSlot?.times[0] ?? "";
            setDate(nextDate);
            setTime(nextTime);
            setEndTime(
              keepBookingDuration(
                nextSlot?.endTimesByStart?.[nextTime] ?? [],
                nextTime,
                time,
                endTime
              )
            );
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Start time</Label>
          <AvailableTimePicker
            name="time"
            value={time}
            availableTimes={availableTimes}
            startTime={bookableStartTime}
            endTime={bookableEndTime}
            disabled={availableTimes.length === 0}
            onChange={(nextTime) => {
              setEndTime(
                keepBookingDuration(
                  selectedSlot?.endTimesByStart?.[nextTime] ?? [],
                  nextTime,
                  time,
                  endTime
                )
              );
              setTime(nextTime);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>End time</Label>
          <AvailableTimePicker
            name="endTime"
            value={endTime}
            availableTimes={availableEndTimes}
            startTime={time || bookableStartTime}
            endTime={bookableEndTime}
            disabled={availableEndTimes.length === 0}
            onChange={setEndTime}
          />
        </div>
      </div>
      <input type="hidden" name="date" value={date} />

      {quoteError && <p className="text-sm text-destructive">{quoteError}</p>}

      {quote && (
        <div className="rounded-lg border p-4 text-sm">
          <p>
            <span className="text-muted-foreground">New price </span>
            <span className="font-medium">{money(quote.amount)}</span>
            <span className="text-muted-foreground"> · already paid {money(booking.paidAmount)}</span>
          </p>
          <p className="mt-2 font-medium">
            {quote.balance > 0
              ? `${money(quote.balance)} to pay — we will email you a secure payment link.`
              : quote.balance < 0
                ? `${money(-quote.balance)} back to your card, refunded automatically.`
                : "Nothing further to pay."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={unchanged || !date || !time || !endTime}>
          Confirm change
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href="/account/bookings">Back to my bookings</a>
        </Button>
      </div>
    </form>
  );
}
