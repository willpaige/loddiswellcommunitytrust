"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, CreditCard, Receipt } from "lucide-react";
import { format } from "date-fns";
import { createManualBooking, getAvailableBookingSlots } from "@/actions/bookings";
import { getCustomerDiscountByEmail } from "@/actions/customers";
import { validateBookingDiscountCode, type DiscountCodeResult } from "@/actions/booking-discount-codes";
import {
  customerGroups,
  money,
  recurrenceLabel,
  recurrenceOptions,
  suggestRecurringAmount,
  type Recurrence,
} from "@/lib/bookings";
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
import { Checkbox } from "@/components/ui/checkbox";

type ManualBookingOffering = {
  offeringId: string;
  offeringName: string;
  facilityName: string;
  facilityBookableStartTime?: string;
  facilityBookableEndTime?: string;
  offeringType?: string;
};

type ManualBookingPrice = {
  offeringId: string;
  customerGroup: string;
  amount: number;
  variableDuration: boolean;
};

type AvailableSlot = {
  date: string;
  times: string[];
  endTimesByStart?: Record<string, string[]>;
};

type CustomSession = { date: string; startTime: string; endTime: string };

export function ManualBookingDialog({
  offerings,
  prices = [],
  repeatDiscount = { threshold: 8, percent: 15 },
  open,
  onOpenChange,
  defaultDate,
  showTrigger = true,
}: {
  offerings: ManualBookingOffering[];
  prices?: ManualBookingPrice[];
  repeatDiscount?: { threshold: number; percent: number };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultDate?: Date;
  showTrigger?: boolean;
}) {
  const router = useRouter();
  const formattedDefaultDate = defaultDate ? format(defaultDate, "yyyy-MM-dd") : "";
  const [internalOpen, setInternalOpen] = useState(false);
  const [offeringId, setOfferingId] = useState(offerings[0]?.offeringId ?? "");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [customSchedule, setCustomSchedule] = useState(false);
  const [customSessions, setCustomSessions] = useState<CustomSession[]>([]);
  const [customPrice, setCustomPrice] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [repeatCount, setRepeatCount] = useState(8);
  const [indefinite, setIndefinite] = useState(false);
  const [repeatPaymentMode, setRepeatPaymentMode] = useState<"upfront" | "subscription">("upfront");
  const [billingInterval, setBillingInterval] = useState<Exclude<Recurrence, "none">>("monthly");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringEdited, setRecurringEdited] = useState(false);
  const [customerDiscountPercent, setCustomerDiscountPercent] = useState(0);
  const [customerEmail, setCustomerEmail] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discountCodeResult, setDiscountCodeResult] = useState<DiscountCodeResult | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"confirmed" | "payment_link" | "invoice">(
    "confirmed"
  );
  const [customerGroup, setCustomerGroup] =
    useState<(typeof customerGroups)[number]["value"]>(customerGroups[0]?.value ?? "parent_private");
  const [promoteOnSite, setPromoteOnSite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const selectedDateSlot = slots.find((slot) => slot.date === date);
  const availableTimes = selectedDateSlot?.times ?? [];
  const availableEndTimes = selectedDateSlot?.endTimesByStart?.[time] ?? [];
  const selectedOffering = offerings.find((offering) => offering.offeringId === offeringId);
  const isKidsParty = selectedOffering?.offeringType === "kids_party";
  const pricingCustomerGroup = isKidsParty ? "parent_private" : customerGroup;
  const bookableStartTime = selectedOffering?.facilityBookableStartTime ?? "08:00";
  const bookableEndTime = selectedOffering?.facilityBookableEndTime ?? "23:00";
  const dialogOpen = open ?? internalOpen;
  const recurring = !isKidsParty && recurrence !== "none";
  const isSubscription = paymentMode === "payment_link" && recurring && repeatPaymentMode === "subscription";
  const needsOrganisationName = customerGroup === "team_community" || customerGroup === "business";
  const organisationLabel =
    customerGroup === "business" ? "Business / event name" : "Club / event name";

  // Per-session price for the selected offering + customer group (pence).
  const priceRow = prices.find(
    (row) => row.offeringId === offeringId && row.customerGroup === pricingCustomerGroup
  );
  const sessionHours =
    time && endTime ? Math.max(1, Number(endTime.slice(0, 2)) - Number(time.slice(0, 2))) : 1;
  const perSessionPence = priceRow
    ? priceRow.amount * (priceRow.variableDuration ? sessionHours : 1)
    : 0;
  const grossSuggestedPence = recurring
    ? suggestRecurringAmount(perSessionPence, recurrence, billingInterval)
    : 0;
  // Apply the customer's discount to the suggestion (once, client-side); the
  // submitted figure is treated as final and is not re-discounted on the server.
  const suggestedRecurringPence = Math.round(
    (grossSuggestedPence * (100 - customerDiscountPercent)) / 100
  );
  const customGrossPence = customSessions.reduce((total, session) => {
    const hours = Math.max(
      1,
      Number(session.endTime.slice(0, 2)) - Number(session.startTime.slice(0, 2))
    );
    return total + (priceRow?.amount ?? 0) * (priceRow?.variableDuration ? hours : 1);
  }, 0);
  const sessionCount = customSchedule ? customSessions.length : recurring ? repeatCount : 1;
  const repeatDiscountApplies =
    (customSchedule || (recurring && !isSubscription && !indefinite)) &&
    sessionCount >= repeatDiscount.threshold;
  const effectiveDiscountPercent = Math.max(
    customerDiscountPercent,
    repeatDiscountApplies ? repeatDiscount.percent : 0,
    discountCodeResult?.valid ? discountCodeResult.discountPercent ?? 0 : 0
  );
  const regularGrossPence = perSessionPence * (recurring && !isSubscription && !indefinite ? repeatCount : 1);
  const automaticTotalPence = Math.round(
    ((customSchedule ? customGrossPence : regularGrossPence) * (100 - effectiveDiscountPercent)) / 100
  );
  const parsedCustomPrice = Number(customPrice);
  const customPricePence = customPrice.trim() === "" || !Number.isFinite(parsedCustomPrice)
    ? null
    : Math.max(0, Math.round(parsedCustomPrice * 100));
  const displayedTotalPence = customSchedule && customPricePence !== null
    ? Math.round((customPricePence * (100 - effectiveDiscountPercent)) / 100)
    : isSubscription
      ? Math.round(
          (Math.max(0, Math.round(Number(recurringAmount || 0) * 100)) *
            (100 - (discountCodeResult?.valid ? discountCodeResult.discountPercent ?? 0 : 0))) / 100
        )
      : automaticTotalPence;

  // Auto-fill the recurring charge with the suggestion until the admin edits it.
  useEffect(() => {
    if (isSubscription && !recurringEdited) {
      setRecurringAmount(suggestedRecurringPence ? (suggestedRecurringPence / 100).toFixed(2) : "");
    }
  }, [isSubscription, recurringEdited, suggestedRecurringPence]);

  function handleOpenChange(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

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

  useEffect(() => {
    if (!isKidsParty) return;
    setCustomerGroup("parent_private");
    setRecurrence("none");
    setCustomSchedule(false);
    setCustomSessions([]);
    setIndefinite(false);
    setPromoteOnSite(false);
  }, [isKidsParty]);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    try {
      await createManualBooking(formData);
      handleOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Manual booking
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manual booking</DialogTitle>
          <DialogDescription>
            Create a confirmed booking or reserve a booking and email a Stripe payment link.
          </DialogDescription>
        </DialogHeader>

        <form
          key={formattedDefaultDate}
          action={handleSubmit}
          className="grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="manualPaymentMode" value={paymentMode} />
          <input type="hidden" name="scheduleType" value={customSchedule ? "custom" : "regular"} />
          <input type="hidden" name="customSessions" value={JSON.stringify(customSessions)} />
          <div className="space-y-2 sm:col-span-2">
            <Label>Payment</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setPaymentMode("confirmed")}
                className={[
                  "flex items-start gap-3 rounded-md border p-3 text-left text-sm transition",
                  paymentMode === "confirmed"
                    ? "border-sage-500 bg-sage-50 text-sage-900"
                    : "hover:border-sage-300",
                ].join(" ")}
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-medium">Confirm without payment</span>
                  <span className="mt-1 block text-muted-foreground">
                    Adds a confirmed booking and sends no Stripe link.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("payment_link")}
                className={[
                  "flex items-start gap-3 rounded-md border p-3 text-left text-sm transition",
                  paymentMode === "payment_link"
                    ? "border-copper-500 bg-copper-50 text-copper-900"
                    : "hover:border-copper-300",
                ].join(" ")}
              >
                <CreditCard className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-medium">Email payment link</span>
                  <span className="mt-1 block text-muted-foreground">
                    Holds the slot as pending and sends a Stripe payment link.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("invoice")}
                className={[
                  "flex items-start gap-3 rounded-md border p-3 text-left text-sm transition",
                  paymentMode === "invoice"
                    ? "border-copper-500 bg-copper-50 text-copper-900"
                    : "hover:border-copper-300",
                ].join(" ")}
              >
                <Receipt className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-medium">Send invoice</span>
                  <span className="mt-1 block text-muted-foreground">
                    Emails a Stripe invoice (card or bank transfer); slot held until paid.
                  </span>
                </span>
              </button>
            </div>
          </div>

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
            <Label>{customSchedule ? "Add a date" : "Date"}</Label>
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

          {!isKidsParty && <div className="space-y-2">
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
          </div>}
          {isKidsParty && <input type="hidden" name="customerGroup" value="parent_private" />}

          {customSchedule && (
            <div className="space-y-3 rounded-md border p-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Selected sessions</p>
                  <p className="text-xs text-muted-foreground">Add between 2 and 52 independently timed sessions.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!date || !time || !endTime || customSessions.length >= 52}
                  onClick={() => {
                    const next = { date, startTime: time, endTime };
                    if (!customSessions.some((item) => JSON.stringify(item) === JSON.stringify(next))) {
                      setCustomSessions((items) => [...items, next].sort((a, b) =>
                        `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)
                      ));
                    }
                  }}
                >
                  Add session
                </Button>
              </div>
              {customSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions added yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {customSessions.map((session) => (
                    <li key={`${session.date}-${session.startTime}-${session.endTime}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span>{format(new Date(`${session.date}T12:00:00`), "d MMM yyyy")} · {session.startTime}–{session.endTime}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCustomSessions((items) => items.filter((item) => item !== session))}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="max-w-xs space-y-2 pt-2">
                <Label htmlFor="customBookingPrice">Custom total price (£)</Label>
                <Input
                  id="customBookingPrice"
                  name="customPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={customPrice}
                  onChange={(event) => setCustomPrice(event.target.value)}
                  placeholder="Leave blank to calculate automatically"
                />
                <p className="text-xs text-muted-foreground">
                  Overrides standard pricing for the whole group and is used for payment links and invoices.
                </p>
              </div>
            </div>
          )}

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

          {!isKidsParty && <div className="space-y-2">
            <Label htmlFor="manualGroup">Customer type</Label>
            <select
              id="manualGroup"
              name="customerGroup"
              value={customerGroup}
              onChange={(event) => {
                const nextGroup = event.target.value as (typeof customerGroups)[number]["value"];
                setCustomerGroup(nextGroup);
                if (event.target.value !== "team_community") setPromoteOnSite(false);
              }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {customerGroups.map((group) => (
                <option key={group.value} value={group.value}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>}
          {isKidsParty && <input type="hidden" name="customerGroup" value="parent_private" />}

          {needsOrganisationName && (
            <div className="space-y-2">
              <Label htmlFor="manualOrganisationName">{organisationLabel}</Label>
              <Input id="manualOrganisationName" name="organisationName" required />
            </div>
          )}

          {!isKidsParty && <div className="flex items-end gap-5 sm:col-span-2">
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={recurring}
                disabled={customSchedule}
                onChange={(event) => setRecurrence(event.target.checked ? "weekly" : "none")}
              />
              Repeat
            </label>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={customSchedule}
                onChange={(event) => {
                  setCustomSchedule(event.target.checked);
                  if (event.target.checked) setRecurrence("none");
                }}
              />
              Custom dates
            </label>
            <input type="hidden" name="recurrence" value={recurrence} />
          </div>}
          {isKidsParty && <input type="hidden" name="recurrence" value="none" />}

          {recurring && !customSchedule && (
            <>
              <input
                type="hidden"
                name="repeatPaymentMode"
                value={paymentMode === "payment_link" ? repeatPaymentMode : "upfront"}
              />
              <div className="space-y-2">
                <Label htmlFor="manualRecurrenceFrequency">Session frequency</Label>
                <select
                  id="manualRecurrenceFrequency"
                  value={recurrence}
                  onChange={(event) => setRecurrence(event.target.value as Recurrence)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {recurrenceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {paymentMode === "confirmed" && (
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    name="indefinite"
                    checked={indefinite}
                    onChange={(event) => setIndefinite(event.target.checked)}
                  />
                  Repeat indefinitely
                </label>
              )}

              {paymentMode === "payment_link" && (
                <div className="space-y-2">
                  <Label htmlFor="manualRepeatPaymentMode">Payment</Label>
                  <select
                    id="manualRepeatPaymentMode"
                    value={repeatPaymentMode}
                    onChange={(event) =>
                      setRepeatPaymentMode(event.target.value as "upfront" | "subscription")
                    }
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="upfront">Pay upfront for a set number of sessions</option>
                    <option value="subscription">Auto-charge card each period (ongoing)</option>
                  </select>
                </div>
              )}

              {isSubscription ? (
                <>
                  <input type="hidden" name="billingInterval" value={billingInterval} />
                  <input
                    type="hidden"
                    name="recurringAmount"
                    value={Math.round(Number(recurringAmount || 0) * 100)}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="manualBillingInterval">Billing frequency</Label>
                    <select
                      id="manualBillingInterval"
                      value={billingInterval}
                      onChange={(event) =>
                        setBillingInterval(event.target.value as Exclude<Recurrence, "none">)
                      }
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      {recurrenceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="manualRecurringAmount">Recurring charge (£)</Label>
                    <Input
                      id="manualRecurringAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={recurringAmount}
                      onChange={(event) => {
                        setRecurringAmount(event.target.value);
                        setRecurringEdited(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Charged every {recurrenceLabel(billingInterval).toLowerCase()} until cancelled.
                      {suggestedRecurringPence > 0 &&
                        ` Suggested ${money(suggestedRecurringPence)} (${recurrenceLabel(recurrence).toLowerCase()} sessions averaged over the year).`}{" "}
                      The first charge is taken when the customer sets up their card via the emailed link.
                    </p>
                  </div>
                </>
              ) : !indefinite || paymentMode !== "confirmed" ? (
                <div className="space-y-2">
                  <Label htmlFor="manualRepeatCount">Number of sessions</Label>
                  <Input
                    id="manualRepeatCount"
                    name="repeatCount"
                    type="number"
                    min="2"
                    max="52"
                    value={repeatCount}
                    onChange={(event) => setRepeatCount(Number(event.target.value))}
                  />
                </div>
              ) : (
                <p className="self-end pb-2 text-sm text-muted-foreground">
                  Sessions are kept available on a rolling 180-day horizon until the booking is cancelled.
                </p>
              )}
            </>
          )}

          <div className="rounded-md border border-sage-200 bg-sage-50 p-4 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-sage-700" aria-hidden="true" />
              <h3 className="font-medium text-sage-900">Booking cost overview</h3>
            </div>
            {priceRow ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-sage-700">Standard session price</dt>
                  <dd>{money(perSessionPence)}</dd>
                </div>
                {customSchedule && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-sage-700">Selected sessions</dt>
                    <dd>{customSessions.length}</dd>
                  </div>
                )}
                {recurring && !indefinite && !isSubscription && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-sage-700">Number of sessions</dt>
                    <dd>{repeatCount}</dd>
                  </div>
                )}
                {!isSubscription && !indefinite && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-sage-700">Standard total</dt>
                    <dd>{money(customSchedule ? customGrossPence : regularGrossPence)}</dd>
                  </div>
                )}
                {effectiveDiscountPercent > 0 && customPricePence === null && !isSubscription && (
                  <div className="flex justify-between gap-4 text-sage-700">
                    <dt>Discount applied</dt>
                    <dd>{effectiveDiscountPercent}%</dd>
                  </div>
                )}
                {customSchedule && customPricePence !== null && (
                  <div className="flex justify-between gap-4 text-copper-700">
                    <dt>Custom price override</dt>
                    <dd>{money(customPricePence)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 border-t border-sage-200 pt-2 text-base font-semibold text-sage-950">
                  <dt>
                    {isSubscription
                      ? `Charge every ${recurrenceLabel(billingInterval).toLowerCase()}`
                      : indefinite
                        ? "Recorded value per session"
                        : paymentMode === "confirmed"
                          ? "Recorded booking value"
                          : "Amount due"}
                  </dt>
                  <dd>{money(indefinite ? perSessionPence : displayedTotalPence)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-sage-700">
                No price is configured for this booking type and customer group.
              </p>
            )}
            <p className="mt-3 text-xs text-sage-700">
              {paymentMode === "confirmed"
                ? "No payment link or invoice will be sent."
                : paymentMode === "invoice"
                  ? "This amount will be used on the Stripe invoice."
                  : "This amount will be used for the Stripe payment link."}
            </p>
            <div className="mt-4 space-y-2 border-t border-sage-200 pt-4">
              <Label htmlFor="manualDiscountCode">Discount code</Label>
              <div className="flex gap-2">
                <Input
                  id="manualDiscountCode"
                  name="discountCode"
                  value={discountCode}
                  onChange={(event) => {
                    setDiscountCode(event.target.value.toUpperCase());
                    setDiscountCodeResult(null);
                  }}
                  placeholder="Enter code"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={checkingCode || !discountCode.trim()}
                  onClick={async () => {
                    setCheckingCode(true);
                    try { setDiscountCodeResult(await validateBookingDiscountCode(discountCode, customerEmail)); }
                    finally { setCheckingCode(false); }
                  }}
                >
                  {checkingCode ? "Checking…" : "Apply"}
                </Button>
              </div>
              {discountCodeResult && (
                <p className={`text-sm ${discountCodeResult.valid ? "text-sage-800" : "text-destructive"}`}>
                  {discountCodeResult.message}
                </p>
              )}
            </div>
          </div>

          {!isKidsParty && customerGroup === "team_community" && (
            <div className="space-y-3 rounded-md border p-4 sm:col-span-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="manualPromoteOnSite"
                  name="promoteOnSite"
                  checked={promoteOnSite}
                  onCheckedChange={(checked) => setPromoteOnSite(checked === true)}
                />
                <div>
                  <Label htmlFor="manualPromoteOnSite" className="font-normal">
                    Promote this booking on the website
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Adds a public event entry after the booking is confirmed.
                  </p>
                </div>
              </div>
              {promoteOnSite && (
                <div className="space-y-2">
                  <Label htmlFor="manualPromotionUrl">More info link</Label>
                  <Input
                    id="manualPromotionUrl"
                    name="promotionUrl"
                    type="url"
                    required={promoteOnSite}
                    placeholder="https://..."
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="manualName">Name</Label>
            <Input id="manualName" name="customerName" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manualEmail">Email</Label>
            <Input
              id="manualEmail"
              name="customerEmail"
              type="email"
              required
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              onBlur={async (event) => {
                const email = event.target.value.trim();
                if (!email) {
                  setCustomerDiscountPercent(0);
                  return;
                }
                try {
                  const pct = await getCustomerDiscountByEmail(email);
                  setCustomerDiscountPercent(pct);
                  if (pct > 0) setRecurringEdited(false);
                } catch {
                  setCustomerDiscountPercent(0);
                }
              }}
            />
            {customerDiscountPercent > 0 && (
              <p className="text-xs text-muted-foreground">
                This customer has a {customerDiscountPercent}% discount applied to their bookings.
              </p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="manualPhone">Phone</Label>
            <Input id="manualPhone" name="customerPhone" />
          </div>

          {paymentMode === "invoice" && (
            <div className="space-y-3 rounded-md border p-4 sm:col-span-2">
              <p className="text-sm font-medium">Billing address</p>
              <p className="text-sm text-muted-foreground">
                Shown as the bill-to on the invoice.
              </p>
              <div className="space-y-2">
                <Label htmlFor="manualBillingLine1">Address line 1</Label>
                <Input id="manualBillingLine1" name="billingLine1" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualBillingLine2">Address line 2</Label>
                <Input id="manualBillingLine2" name="billingLine2" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manualBillingCity">Town / city</Label>
                  <Input id="manualBillingCity" name="billingCity" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualBillingPostcode">Postcode</Label>
                  <Input id="manualBillingPostcode" name="billingPostcode" required />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="manualNotes">Notes</Label>
            <Input id="manualNotes" name="notes" />
          </div>

          <div className="flex justify-end sm:col-span-2">
            <Button
              type="submit"
              disabled={saving || loadingSlots || slots.length === 0 ||
                (customSchedule && customSessions.length < 2) ||
                Boolean(discountCode.trim() && !discountCodeResult?.valid)}
            >
              {saving
                ? "Creating booking..."
                : loadingSlots
                ? "Checking availability..."
                : isSubscription
                  ? "Create and send card setup link"
                  : paymentMode === "payment_link"
                    ? "Create and send payment link"
                    : paymentMode === "invoice"
                      ? "Create and send invoice"
                      : "Create confirmed booking"}
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
