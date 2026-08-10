"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { createBookingCheckout, getAvailableBookingSlots } from "@/actions/bookings";
import { validateBookingDiscountCode, type DiscountCodeResult } from "@/actions/booking-discount-codes";
import {
  capacityUnitNoun,
  customerGroups,
  money,
  recurrenceIntervalLabel,
  recurrenceLabel,
  recurrenceOptions,
  type Recurrence,
} from "@/lib/bookings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AvailableDatePicker } from "@/components/booking/available-date-picker";
import { AvailableTimePicker } from "@/components/booking/available-time-picker";

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
  capacity: number;
  startTime: string | null;
  endTime: string | null;
  customerGroup: string;
  amount: number;
};

type AvailableSlot = {
  date: string;
  times: string[];
  endTimesByStart?: Record<string, string[]>;
  remainingByRange?: Record<string, Record<string, number>>;
};

export function BookingForm({
  offerings,
  repeatDiscount,
  initialDate,
  customerDiscountPercent = 0,
}: {
  offerings: OfferingRow[];
  repeatDiscount: { threshold: number; percent: number };
  initialDate?: string;
  customerDiscountPercent?: number;
}) {
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
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [repeatPaymentMode, setRepeatPaymentMode] = useState<"subscription" | "upfront">("subscription");
  const [repeatCount, setRepeatCount] = useState(repeatDiscount.threshold);
  const [promoteOnSite, setPromoteOnSite] = useState(false);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountCodeResult, setDiscountCodeResult] = useState<DiscountCodeResult | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  const selectedOffering =
    facilityOfferings.find((offering) => offering.offeringId === offeringId) ||
    facilityOfferings[0];
  const isKidsParty = selectedOffering?.offeringType === "kids_party";
  const pricingCustomerGroup = isKidsParty ? "parent_private" : customerGroup;
  const selectedPrice = offerings.find(
    (offering) =>
      offering.offeringId === selectedOffering?.offeringId &&
      offering.customerGroup === pricingCustomerGroup
  );
  const selectedFacility = facilities.find((facility) => facility.id === facilityId);
  const selectedDateSlot = slots.find((slot) => slot.date === date);
  const availableTimes = selectedDateSlot?.times ?? [];
  const availableEndTimes = selectedDateSlot?.endTimesByStart?.[time] ?? [];
  const remainingByRange = selectedDateSlot?.remainingByRange ?? {};
  // The hint has to track the duration the customer has actually picked: an hour
  // may have both courts free while the three-hour range from it has only one.
  // Before an end time is chosen, fall back to the shortest bookable range.
  const remainingForStart = (startOption: string) => {
    const byEnd = remainingByRange[startOption];
    if (!byEnd) return undefined;
    if (startOption === time && endTime && byEnd[endTime] !== undefined) return byEnd[endTime];
    const shortest = selectedDateSlot?.endTimesByStart?.[startOption]?.[0];
    return shortest ? byEnd[shortest] : undefined;
  };
  const remainingByStart = Object.fromEntries(
    availableTimes.flatMap((option) => {
      const remaining = remainingForStart(option);
      return remaining === undefined ? [] : [[option, remaining] as const];
    })
  );
  const remainingByEndTime = remainingByRange[time] ?? {};
  const hasAvailability = slots.length > 0;
  const recurring = !isKidsParty && recurrence !== "none";
  const selectedHours =
    time && endTime ? Math.max(1, Number(endTime.slice(0, 2)) - Number(time.slice(0, 2))) : 1;
  const displayAmount = selectedPrice
    ? selectedPrice.amount * (selectedOffering?.startTime ? 1 : selectedHours)
    : 0;
  const repeatEligible =
    recurring &&
    repeatPaymentMode === "upfront" &&
    repeatDiscount.percent > 0 &&
    repeatCount >= repeatDiscount.threshold;
  // Mirror the server's bookingAmount: take the larger of the customer discount
  // and an eligible repeat-booking discount — never stack.
  const effectivePct = Math.max(
    customerDiscountPercent,
    repeatEligible ? repeatDiscount.percent : 0,
    discountCodeResult?.valid ? discountCodeResult.discountPercent ?? 0 : 0
  );
  const needsOrganisationName = !isKidsParty && (customerGroup === "team_community" || customerGroup === "business");
  const organisationLabel =
    customerGroup === "business" ? "Business / event name" : "Club / event name";
  const upfrontSubtotal = displayAmount * repeatCount;
  const subtotal = recurring
    ? repeatPaymentMode === "upfront"
      ? upfrontSubtotal
      : displayAmount
    : displayAmount;
  const totalAmount = Math.round((subtotal * (100 - effectivePct)) / 100);
  const recurringDiscountAmount = subtotal - totalAmount;

  useEffect(() => {
    if (!offeringId) return;
    let cancelled = false;
    setLoadingSlots(true);
    getAvailableBookingSlots(offeringId)
      .then((nextSlots) => {
        if (cancelled) return;
        const initialSlot = initialDate
          ? nextSlots.find((slot) => slot.date === initialDate)
          : undefined;
        const firstSlot = initialSlot ?? nextSlots[0];
        const firstTime = firstSlot?.times[0] ?? "";
        setSlots(nextSlots);
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
  }, [offeringId, initialDate]);

  useEffect(() => {
    if (!isKidsParty) return;
    setCustomerGroup("parent_private");
    setRecurrence("none");
    setRepeatPaymentMode("upfront");
    setPromoteOnSite(false);
  }, [isKidsParty]);

  function handleFacilityChange(value: string) {
    setFacilityId(value);
    const next = offerings.find((offering) => offering.facilityId === value);
    setOfferingId(next?.offeringId || "");
  }

  async function applyDiscountCode() {
    setCheckingCode(true);
    try {
      setDiscountCodeResult(await validateBookingDiscountCode(discountCode));
    } finally {
      setCheckingCode(false);
    }
  }

  return (
    <form action={createBookingCheckout} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <input type="hidden" name="facilityId" value={facilityId} />
      <input type="hidden" name="discountCode" value={discountCode} />
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Date</Label>
              <input type="hidden" name="date" value={date} required />
              <AvailableDatePicker
                slots={slots}
                value={date}
                disabled={loadingSlots || !hasAvailability}
                onChange={(nextDate) => {
                  const nextSlot = slots.find((slot) => slot.date === nextDate);
                  const nextTime = nextSlot?.times[0] ?? "";
                  setDate(nextDate);
                  setTime(nextTime);
                  setEndTime(nextSlot?.endTimesByStart?.[nextTime]?.[0] ?? "");
                }}
              />
            </div>
            {!selectedOffering?.startTime && (
              <div className="space-y-2">
                <Label>Start time</Label>
                <AvailableTimePicker
                  name="time"
                  value={time}
                  availableTimes={availableTimes}
                  remainingByTime={remainingByStart}
                  capacity={selectedOffering?.capacity ?? 1}
                  unitNoun={capacityUnitNoun(selectedFacility?.slug ?? "", 1)}
                  startTime={selectedFacility?.bookableStartTime ?? "08:00"}
                  endTime={selectedFacility?.bookableEndTime ?? "23:00"}
                  disabled={loadingSlots || availableTimes.length === 0}
                  onChange={(nextTime) => {
                    setTime(nextTime);
                    setEndTime(selectedDateSlot?.endTimesByStart?.[nextTime]?.[0] ?? "");
                  }}
                />
              </div>
            )}
            {!selectedOffering?.startTime && (
              <div className="space-y-2">
                <Label>End time</Label>
                <AvailableTimePicker
                  name="endTime"
                  value={endTime}
                  availableTimes={availableEndTimes}
                  remainingByTime={remainingByEndTime}
                  capacity={selectedOffering?.capacity ?? 1}
                  unitNoun={capacityUnitNoun(selectedFacility?.slug ?? "", 1)}
                  startTime={time || selectedFacility?.bookableStartTime || "08:00"}
                  endTime={selectedFacility?.bookableEndTime ?? "23:00"}
                  disabled={loadingSlots || availableEndTimes.length === 0}
                  onChange={setEndTime}
                />
              </div>
            )}
            {!isKidsParty && <div className="space-y-2">
              <Label htmlFor="customerGroup">Customer type</Label>
              <select
                id="customerGroup"
                name="customerGroup"
                value={customerGroup}
                onChange={(event) => {
                  const nextGroup = event.target.value as (typeof customerGroups)[number]["value"];
                  setCustomerGroup(nextGroup);
                  if (nextGroup !== "team_community") setPromoteOnSite(false);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {customerGroups.map((group) => (
                  <option key={group.value} value={group.value}>
                    {group.label}
                  </option>
                ))}
              </select>
            </div>}
            {isKidsParty && <input type="hidden" name="customerGroup" value="parent_private" />}
          </div>

          {!isKidsParty && customerGroup === "team_community" && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="promoteOnSite"
                  name="promoteOnSite"
                  checked={promoteOnSite}
                  onCheckedChange={(checked) => setPromoteOnSite(checked === true)}
                />
                <div>
                  <Label htmlFor="promoteOnSite" className="font-normal">
                    Promote this booking on the website
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Once confirmed, this will add an event entry to the Events page and public
                    calendar.
                  </p>
                </div>
              </div>
              {promoteOnSite && (
                <div className="space-y-2">
                  <Label htmlFor="promotionUrl">More info link</Label>
                  <Input
                    id="promotionUrl"
                    name="promotionUrl"
                    type="url"
                    required={promoteOnSite}
                    placeholder="https://..."
                  />
                </div>
              )}
            </div>
          )}

          {!isKidsParty && <div className="flex items-center gap-3 rounded-md border p-3">
            <Checkbox
              id="recurring"
              checked={recurring}
              onCheckedChange={(checked) => {
                const nextRecurring = checked === true;
                setRecurrence(nextRecurring ? "weekly" : "none");
                if (!nextRecurring) setRepeatPaymentMode("subscription");
              }}
            />
            <Label htmlFor="recurring" className="font-normal">
              Repeat this booking
            </Label>
            <input type="hidden" name="recurrence" value={recurrence} />
          </div>}
          {isKidsParty && <input type="hidden" name="recurrence" value="none" />}
          {recurring && !isKidsParty && (
            <div className="space-y-4 rounded-md border p-4">
              <input type="hidden" name="repeatPaymentMode" value={repeatPaymentMode} />
              <div className="space-y-2">
                <Label htmlFor="recurrenceFrequency">Frequency</Label>
                <select
                  id="recurrenceFrequency"
                  value={recurrence}
                  onChange={(event) => setRecurrence(event.target.value as Recurrence)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {recurrenceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRepeatPaymentMode("subscription")}
                  className={[
                    "rounded-md border p-3 text-left transition",
                    repeatPaymentMode === "subscription"
                      ? "border-copper-500 bg-copper-50"
                      : "hover:border-copper-300",
                  ].join(" ")}
                >
                  <span className="block font-medium">Pay by subscription</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Automatically charged every {recurrenceIntervalLabel(recurrence)}.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRepeatPaymentMode("upfront")}
                  className={[
                    "rounded-md border p-3 text-left transition",
                    repeatPaymentMode === "upfront"
                      ? "border-copper-500 bg-copper-50"
                      : "hover:border-copper-300",
                  ].join(" ")}
                >
                  <span className="block font-medium">Pay upfront</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Book {repeatDiscount.threshold}+ sessions now for {repeatDiscount.percent}% off.
                  </span>
                </button>
              </div>

              {repeatPaymentMode === "upfront" && (
                <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="repeatCount">Number of sessions</Label>
                    <Input
                      id="repeatCount"
                      name="repeatCount"
                      type="number"
                      min="2"
                      max="52"
                      step="1"
                      value={repeatCount}
                      onChange={(event) =>
                        setRepeatCount(
                          Math.max(2, Math.min(52, Math.round(Number(event.target.value) || 2)))
                        )
                      }
                    />
                  </div>
                  {repeatDiscount.percent > 0 && (
                    <p className="self-end rounded-md bg-copper-50 px-3 py-2 text-sm text-copper-900">
                      {repeatCount >= repeatDiscount.threshold
                        ? `${repeatDiscount.percent}% discount applied automatically.`
                        : `Book ${repeatDiscount.threshold}+ repeat sessions to get ${repeatDiscount.percent}% off.`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerName">Name</Label>
              <Input id="customerName" name="customerName" autoComplete="name" required />
            </div>
            {needsOrganisationName && (
              <div className="space-y-2">
                <Label htmlFor="organisationName">{organisationLabel}</Label>
                <Input id="organisationName" name="organisationName" required />
              </div>
            )}
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

      <Card className="h-fit lg:sticky lg:top-24 lg:self-start">
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
                : time && endTime
                  ? `${time} to ${endTime}`
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
              {recurring
                ? repeatPaymentMode === "upfront"
                  ? "Card payment today"
                  : `${recurrenceLabel(recurrence)} subscription`
                : "Card payment today"}
            </p>
            {recurringDiscountAmount > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Subtotal {money(subtotal)} · {effectivePct}% discount -{money(recurringDiscountAmount)}
              </p>
            )}
            {recurring && repeatPaymentMode === "subscription" && (
              <p className="mt-2 text-sm text-muted-foreground">
                Charged every {recurrenceIntervalLabel(recurrence)}.
              </p>
            )}
            {recurring && repeatPaymentMode === "upfront" && (
              <p className="mt-2 text-sm text-muted-foreground">
                {repeatCount} {recurrenceLabel(recurrence).toLowerCase()} sessions paid upfront.
              </p>
            )}
            <p className="mt-1 text-2xl font-semibold">
              {selectedPrice ? money(totalAmount) : "—"}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="discountCodeDisplay">Discount code</Label>
            <div className="flex gap-2">
              <Input
                id="discountCodeDisplay"
                value={discountCode}
                onChange={(event) => {
                  setDiscountCode(event.target.value.toUpperCase());
                  setDiscountCodeResult(null);
                }}
                placeholder="Enter code"
              />
              <Button type="button" variant="outline" onClick={applyDiscountCode} disabled={checkingCode || !discountCode.trim()}>
                {checkingCode ? "Checking…" : "Apply"}
              </Button>
            </div>
            {discountCodeResult && (
              <p className={`text-sm ${discountCodeResult.valid ? "text-sage-700" : "text-destructive"}`}>
                {discountCodeResult.message}
                {discountCodeResult.valid && (discountCodeResult.discountPercent ?? 0) < effectivePct
                  ? " Your larger existing discount is used."
                  : ""}
              </p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loadingSlots || !hasAvailability || Boolean(discountCode.trim() && !discountCodeResult?.valid)}
          >
            {loadingSlots ? "Checking availability..." : "Continue to payment"}
          </Button>
          {!loadingSlots && !hasAvailability && (
            <p className="text-sm text-destructive">
              No available dates for this booking type.
            </p>
          )}
          {discountCode.trim() && !discountCodeResult?.valid && (
            <p className="text-sm text-muted-foreground">Apply the discount code before continuing.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Online cancellations are available up to 48 hours before the booking.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}
