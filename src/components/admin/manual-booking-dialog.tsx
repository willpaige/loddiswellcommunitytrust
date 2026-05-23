"use client";

import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { createManualBooking, getAvailableBookingSlots } from "@/actions/bookings";
import { customerGroups } from "@/lib/bookings";
import { AvailableDatePicker } from "@/components/booking/available-date-picker";
import { AvailableTimePicker } from "@/components/booking/available-time-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ManualBookingOffering = {
  offeringId: string;
  offeringName: string;
  facilityName: string;
  facilityBookableStartTime?: string;
  facilityBookableEndTime?: string;
};

type AvailableSlot = {
  date: string;
  times: string[];
  endTimesByStart?: Record<string, string[]>;
};

export function ManualBookingDialog({
  offerings,
  open,
  onOpenChange,
  defaultDate,
  showTrigger = true,
}: {
  offerings: ManualBookingOffering[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultDate?: Date;
  showTrigger?: boolean;
}) {
  const formattedDefaultDate = defaultDate ? format(defaultDate, "yyyy-MM-dd") : "";
  const [offeringId, setOfferingId] = useState(offerings[0]?.offeringId ?? "");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const selectedDateSlot = slots.find((slot) => slot.date === date);
  const availableTimes = selectedDateSlot?.times ?? [];
  const availableEndTimes = selectedDateSlot?.endTimesByStart?.[time] ?? [];
  const selectedOffering = offerings.find((offering) => offering.offeringId === offeringId);
  const bookableStartTime = selectedOffering?.facilityBookableStartTime ?? "08:00";
  const bookableEndTime = selectedOffering?.facilityBookableEndTime ?? "23:00";

  useEffect(() => {
    if (!offeringId) return;
    let cancelled = false;
    setLoadingSlots(true);
    getAvailableBookingSlots(offeringId)
      .then((nextSlots) => {
        if (cancelled) return;
        setSlots(nextSlots);
        const matchingDefault = nextSlots.find(
          (slot) => slot.date === formattedDefaultDate
        );
        const firstSlot = matchingDefault ?? nextSlots[0];
        const firstTime = firstSlot?.times[0] ?? "";
        setDate(firstSlot?.date ?? "");
        setTime(firstTime);
        setEndTime(firstSlot?.endTimesByStart?.[firstTime]?.[0] ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offeringId, formattedDefaultDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Manual booking
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manual booking</DialogTitle>
          <DialogDescription>
            Create a confirmed booking without taking online payment.
          </DialogDescription>
        </DialogHeader>

        <form
          key={formattedDefaultDate}
          action={createManualBooking}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="manualOffering">Booking type</Label>
            <select
              id="manualOffering"
              name="offeringId"
              value={offeringId}
              onChange={(event) => setOfferingId(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {offerings.map((offering) => (
                <option key={offering.offeringId} value={offering.offeringId}>
                  {offering.facilityName} - {offering.offeringName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Date</Label>
            <input type="hidden" name="date" value={date} required />
            <AvailableDatePicker
              slots={slots}
              value={date}
              disabled={loadingSlots || slots.length === 0}
              onChange={(nextDate) => {
                const nextSlot = slots.find((slot) => slot.date === nextDate);
                const nextTime = nextSlot?.times[0] ?? "";
                setDate(nextDate);
                setTime(nextTime);
                setEndTime(nextSlot?.endTimesByStart?.[nextTime]?.[0] ?? "");
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Start time</Label>
            <AvailableTimePicker
              name="time"
              value={time}
              availableTimes={availableTimes}
              startTime={bookableStartTime}
              endTime={bookableEndTime}
              disabled={loadingSlots || availableTimes.length === 0}
              onChange={(nextTime) => {
                setTime(nextTime);
                setEndTime(selectedDateSlot?.endTimesByStart?.[nextTime]?.[0] ?? "");
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
              disabled={loadingSlots || availableEndTimes.length === 0}
              onChange={setEndTime}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manualGroup">Customer type</Label>
            <select
              id="manualGroup"
              name="customerGroup"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {customerGroups.map((group) => (
                <option key={group.value} value={group.value}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex h-10 items-center gap-2 text-sm">
              <input type="checkbox" name="recurrence" value="weekly" />
              Weekly
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manualName">Name</Label>
            <Input id="manualName" name="customerName" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manualEmail">Email</Label>
            <Input id="manualEmail" name="customerEmail" type="email" required />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="manualPhone">Phone</Label>
            <Input id="manualPhone" name="customerPhone" />
          </div>

          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={loadingSlots || slots.length === 0}>
              {loadingSlots ? "Checking availability..." : "Create booking"}
            </Button>
          </div>
          {!loadingSlots && slots.length === 0 && (
            <p className="text-sm text-destructive sm:col-span-2">
              No available dates for this booking type.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
