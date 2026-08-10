"use client";

import { useState } from "react";
import { createBookingBlock } from "@/actions/bookings";
import { bookingHourOptions, capacityUnitNoun, recurrenceOptions } from "@/lib/bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BookingBlockForm({
  facilities,
}: {
  facilities: Array<{
    facilityId: string;
    facilityName: string;
    facilitySlug: string;
    capacity: number;
  }>;
}) {
  const [recurrence, setRecurrence] = useState("none");
  const [facilityId, setFacilityId] = useState(facilities[0]?.facilityId ?? "");
  const repeating = recurrence !== "none";
  const selectedFacility = facilities.find((facility) => facility.facilityId === facilityId);
  const maxCapacity = selectedFacility?.capacity ?? 1;

  return (
    <form action={createBookingBlock} className="grid gap-4 lg:grid-cols-6">
      <div className="space-y-2">
        <Label htmlFor="blockFacility">Venue</Label>
        <select id="blockFacility" name="facilityId" value={facilityId} onChange={(event) => setFacilityId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {facilities.map((facility) => <option key={facility.facilityId} value={facility.facilityId}>{facility.facilityName}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="blockTitle">Title</Label>
        <Input id="blockTitle" name="title" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="blockStartDate">Start date</Label>
        <Input id="blockStartDate" name="startDate" type="date" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="blockStartTime">Start time</Label>
        <select id="blockStartTime" name="startTime" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="09:00" required>
          {bookingHourOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="blockEndDate">End date</Label>
        <Input id="blockEndDate" name="endDate" type="date" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="blockEndTime">End time</Label>
        <select id="blockEndTime" name="endTime" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="10:00" required>
          {bookingHourOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {maxCapacity > 1 && selectedFacility && (
        <div className="space-y-2">
          <Label htmlFor="blockCapacity" className="capitalize">
            {capacityUnitNoun(selectedFacility.facilitySlug, 2)} blocked
          </Label>
          <select id="blockCapacity" name="capacity" defaultValue="" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">All ({maxCapacity})</option>
            {Array.from({ length: maxCapacity - 1 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>{count} of {maxCapacity}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Reserves a number of {capacityUnitNoun(selectedFacility.facilitySlug, 2)}, not a specific one.
          </p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="blockRecurrence">Repeat</Label>
        <select id="blockRecurrence" name="recurrence" value={recurrence} onChange={(event) => setRecurrence(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="none">Does not repeat</option>
          {recurrenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {repeating && (
        <>
          <div className="space-y-2">
            <Label htmlFor="blockRepeatCount">Number of blocks</Label>
            <Input id="blockRepeatCount" name="repeatCount" type="number" min="2" max="104" defaultValue="2" />
            <p className="text-xs text-muted-foreground">Total occurrences to create, including the first.</p>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="indefinite" /> Repeat indefinitely
          </label>
        </>
      )}
      <div className="flex items-end lg:col-span-2"><Button type="submit">Block</Button></div>
    </form>
  );
}
