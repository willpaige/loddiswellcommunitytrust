"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { createBookingCheckout } from "@/actions/bookings";
import { bookingHourOptions, customerGroups, money } from "@/lib/bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type OfferingRow = {
  facilityId: string;
  facilityName: string;
  facilitySlug: string;
  facilityHeroImageUrl: string | null;
  facilityBookableStartTime: string;
  facilityBookableEndTime: string;
  offeringId: string;
  offeringName: string;
  offeringType: string;
  durationMinutes: number;
  startTime: string | null;
  endTime: string | null;
  customerGroup: string;
  amount: number;
};

export function BookingForm({ offerings }: { offerings: OfferingRow[] }) {
  const facilities = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        heroImageUrl: string | null;
        bookableStartTime: string;
        bookableEndTime: string;
      }
    >();
    offerings.forEach((offering) =>
      map.set(offering.facilityId, {
        id: offering.facilityId,
        name: offering.facilityName,
        slug: offering.facilitySlug,
        heroImageUrl: offering.facilityHeroImageUrl,
        bookableStartTime: offering.facilityBookableStartTime,
        bookableEndTime: offering.facilityBookableEndTime,
      })
    );
    return Array.from(map.values());
  }, [offerings]);

  const [facilityId, setFacilityId] = useState(facilities[0]?.id || "");
  const facilityOfferings = offerings.filter((offering) => offering.facilityId === facilityId);
  const firstOfferingId = facilityOfferings[0]?.offeringId || "";
  const [offeringId, setOfferingId] = useState(firstOfferingId);
  const [customerGroup, setCustomerGroup] = useState<(typeof customerGroups)[number]["value"]>("parent_private");
  const [recurring, setRecurring] = useState(false);

  const selectedOffering =
    facilityOfferings.find((offering) => offering.offeringId === offeringId) ||
    facilityOfferings[0];
  const selectedPrice = offerings.find(
    (offering) =>
      offering.offeringId === selectedOffering?.offeringId &&
      offering.customerGroup === customerGroup
  );
  const selectedFacility = facilities.find((facility) => facility.id === facilityId);
  const filteredHourOptions = bookingHourOptions.filter((option) => {
    if (!selectedOffering || !selectedFacility) return true;
    const optionHour = Number(option.value.slice(0, 2));
    const startHour = Number(selectedFacility.bookableStartTime.slice(0, 2));
    const endHour = Number(selectedFacility.bookableEndTime.slice(0, 2));
    const durationHours = selectedOffering.durationMinutes / 60;
    return optionHour >= startHour && optionHour + durationHours <= endHour;
  });

  function handleFacilityChange(value: string) {
    setFacilityId(value);
    const next = offerings.find((offering) => offering.facilityId === value);
    setOfferingId(next?.offeringId || "");
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  return (
    <form action={createBookingCheckout} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <input type="hidden" name="facilityId" value={facilityId} />
      <Card>
        <CardHeader>
          <CardTitle>Choose your booking</CardTitle>
          <CardDescription>
            Select a venue, time, and customer type. Payment confirms the booking instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <Label>Venue</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {facilities.map((facility) => {
                const selected = facility.id === facilityId;
                return (
                  <button
                    key={facility.id}
                    type="button"
                    onClick={() => handleFacilityChange(facility.id)}
                    aria-pressed={selected}
                    className={[
                      "group relative min-h-36 overflow-hidden rounded-lg border text-left shadow-sm transition",
                      selected
                        ? "border-copper-500 ring-2 ring-copper-500/30"
                        : "border-border hover:border-copper-500/70",
                    ].join(" ")}
                  >
                    {facility.heroImageUrl ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundImage: `url('${facility.heroImageUrl}')` }}
                      />
                    ) : (
                      <span aria-hidden="true" className="absolute inset-0 bg-muted" />
                    )}
                    <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
                    <span className="relative flex min-h-36 flex-col justify-end p-4 text-white">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-base font-semibold">{facility.name}</span>
                        {selected && (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-copper-500">
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offeringId">Booking type</Label>
              <select
                id="offeringId"
                name="offeringId"
                value={selectedOffering?.offeringId || ""}
                onChange={(event) => setOfferingId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {facilityOfferings
                  .filter(
                    (offering, index, arr) =>
                      arr.findIndex((item) => item.offeringId === offering.offeringId) === index
                  )
                  .map((offering) => (
                    <option key={offering.offeringId} value={offering.offeringId}>
                      {offering.offeringName}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" min={minDate} required />
            </div>
            {!selectedOffering?.startTime && (
              <div className="space-y-2">
                <Label htmlFor="time">Start time</Label>
                <select
                  key={`${facilityId}-${selectedOffering?.offeringId || "none"}`}
                  id="time"
                  name="time"
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={
                    filteredHourOptions.some((option) => option.value === "09:00")
                      ? "09:00"
                      : filteredHourOptions[0]?.value
                  }
                >
                  {filteredHourOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="customerGroup">Customer type</Label>
              <select
                id="customerGroup"
                name="customerGroup"
                value={customerGroup}
                onChange={(event) =>
                  setCustomerGroup(event.target.value as (typeof customerGroups)[number]["value"])
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {customerGroups.map((group) => (
                  <option key={group.value} value={group.value}>
                    {group.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md border p-3">
            <Checkbox
              id="recurring"
              checked={recurring}
              onCheckedChange={(checked) => setRecurring(checked === true)}
            />
            <Label htmlFor="recurring" className="font-normal">
              Repeat weekly and pay monthly
            </Label>
            <input type="hidden" name="recurrence" value={recurring ? "weekly" : "none"} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerName">Name</Label>
              <Input id="customerName" name="customerName" autoComplete="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input id="customerPhone" name="customerPhone" autoComplete="tel" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Access needs, setup notes, or anything the Trust should know." />
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>{selectedOffering?.facilityName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">{selectedOffering?.offeringName}</p>
            <p className="text-sm text-muted-foreground">
              {selectedOffering?.startTime
                ? `${selectedOffering.startTime} to ${selectedOffering.endTime}`
                : `${selectedOffering?.durationMinutes || 60} minutes`}
            </p>
            {selectedFacility && (
              <p className="mt-1 text-xs text-muted-foreground">
                Bookable between {selectedFacility.bookableStartTime} and{" "}
                {selectedFacility.bookableEndTime}
              </p>
            )}
          </div>
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              {recurring ? "Monthly subscription" : "Card payment today"}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {selectedPrice ? money(recurring ? selectedPrice.amount * 4 : selectedPrice.amount) : "—"}
            </p>
          </div>
          <Button type="submit" className="w-full">
            Continue to payment
          </Button>
          <p className="text-xs text-muted-foreground">
            Online cancellations are available up to 48 hours before the booking.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}
