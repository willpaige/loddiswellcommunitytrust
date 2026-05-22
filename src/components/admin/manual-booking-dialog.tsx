"use client";

import { CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { createManualBooking } from "@/actions/bookings";
import { bookingHourOptions, customerGroups } from "@/lib/bookings";
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
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {offerings.map((offering) => (
                <option key={offering.offeringId} value={offering.offeringId}>
                  {offering.facilityName} - {offering.offeringName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manualDate">Date</Label>
            <Input
              id="manualDate"
              name="date"
              type="date"
              defaultValue={formattedDefaultDate}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manualTime">Start time</Label>
            <select
              id="manualTime"
              name="time"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue="09:00"
            >
              {bookingHourOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
            <Button type="submit">Create booking</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
