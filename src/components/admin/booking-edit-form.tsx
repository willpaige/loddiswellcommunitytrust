"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bookingDateKey, formatBookingDate } from "@/lib/booking-time";
import {
  createBookingInvoice,
  getAvailableBookingSlots,
  markBookingInvoicePaidOutOfBand,
  recordBookingSettlement,
  updateAdminBooking,
} from "@/actions/bookings";
import { bookingBalance, customerGroups, money, recurrenceOptions, type Recurrence } from "@/lib/bookings";
import { AvailableDatePicker } from "@/components/booking/available-date-picker";
import { AvailableTimePicker } from "@/components/booking/available-time-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Offering = {
  offeringId: string;
  offeringName: string;
  facilityName: string;
  facilityBookableStartTime?: string;
  facilityBookableEndTime?: string;
};

type Booking = {
  id: string;
  offeringId: string | null;
  customerGroup: string;
  customerName: string;
  organisationName: string | null;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
  startDate: Date;
  endDate: Date;
  recurrence: Recurrence;
  scheduleType: "regular" | "custom";
  repeatCount: number;
  billingLine1: string | null;
  billingLine2: string | null;
  billingCity: string | null;
  billingPostcode: string | null;
  amount: number;
  paidAmount: number;
  stripeInvoiceId: string | null;
  invoiceStatus: "draft" | "open" | "paid" | "uncollectible" | "void" | null;
  invoiceHostedUrl: string | null;
};

const invoiceStatusLabels: Record<string, string> = {
  draft: "Draft",
  open: "Sent · unpaid",
  paid: "Paid",
  uncollectible: "Uncollectible",
  void: "Void",
};

type AvailableSlot = {
  date: string;
  times: string[];
  endTimesByStart?: Record<string, string[]>;
};

export function BookingEditForm({
  booking,
  offerings,
}: {
  booking: Booking;
  offerings: Offering[];
}) {
  const router = useRouter();
  const [offeringId, setOfferingId] = useState(booking.offeringId ?? offerings[0]?.offeringId ?? "");
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [date, setDate] = useState(bookingDateKey(booking.startDate));
  const [time, setTime] = useState(formatBookingDate(booking.startDate, "HH:00"));
  const [endTime, setEndTime] = useState(formatBookingDate(booking.endDate, "HH:00"));
  const [recurrence, setRecurrence] = useState<Recurrence>(booking.recurrence);
  const [repeatCount, setRepeatCount] = useState(booking.repeatCount || 1);
  const [customerGroup, setCustomerGroup] =
    useState<(typeof customerGroups)[number]["value"]>(
      booking.customerGroup as (typeof customerGroups)[number]["value"]
    );
  const [saving, setSaving] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  // Changing the date or start time used to drop the end time to the earliest
  // one on offer, quietly shortening the booking. Keep the length the customer
  // booked whenever that end is still free, and only fall back when it is not.
  function keepDuration(
    slot: AvailableSlot | undefined,
    nextTime: string,
    currentTime: string,
    currentEndTime: string
  ) {
    const options = slot?.endTimesByStart?.[nextTime] ?? [];
    const hours = (time: string) => Number(time.slice(0, 2));
    const duration = hours(currentEndTime) - hours(currentTime);
    if (duration > 0) {
      const wanted = `${String(hours(nextTime) + duration).padStart(2, "0")}:00`;
      if (options.includes(wanted)) return wanted;
    }
    if (options.includes(currentEndTime)) return currentEndTime;
    return options[0] ?? "";
  }

  const balance = bookingBalance(booking);
  const selectedOffering = offerings.find((offering) => offering.offeringId === offeringId);
  const selectedDateSlot = slots.find((slot) => slot.date === date);
  const availableTimes = useMemo(() => {
    const current = bookingDateKey(booking.startDate) === date ? [formatBookingDate(booking.startDate, "HH:00")] : [];
    return Array.from(new Set([...(selectedDateSlot?.times ?? []), ...current])).sort();
  }, [booking.startDate, date, selectedDateSlot?.times]);
  const availableEndTimes = useMemo(() => {
    const current = bookingDateKey(booking.startDate) === date && time === formatBookingDate(booking.startDate, "HH:00")
      ? [formatBookingDate(booking.endDate, "HH:00")]
      : [];
    return Array.from(new Set([...(selectedDateSlot?.endTimesByStart?.[time] ?? []), ...current])).sort();
  }, [booking.endDate, booking.startDate, date, selectedDateSlot?.endTimesByStart, time]);
  const needsOrganisationName = customerGroup === "team_community" || customerGroup === "business";
  const recurring = recurrence !== "none";
  const organisationLabel =
    customerGroup === "business" ? "Business / event name" : "Club / event name";

  useEffect(() => {
    if (!offeringId) return;
    let cancelled = false;
    setLoadingSlots(true);
    getAvailableBookingSlots(offeringId, booking.id)
      .then((nextSlots) => {
        if (!cancelled) setSlots(nextSlots);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [booking.id, offeringId]);

  async function handleGenerateInvoice() {
    setInvoiceBusy(true);
    setInvoiceError(null);
    try {
      await createBookingInvoice(booking.id);
      router.refresh();
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : "Could not create the invoice.");
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function handleMarkPaid() {
    setInvoiceBusy(true);
    setInvoiceError(null);
    try {
      await markBookingInvoicePaidOutOfBand(booking.id);
      router.refresh();
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : "Could not mark the invoice paid.");
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    formData.set("date", date);
    formData.set("time", time);
    formData.set("endTime", endTime);
    formData.set("recurrence", recurrence);
    formData.set("repeatPaymentMode", "upfront");
    formData.set("repeatCount", String(repeatCount));
    setSaving(true);
    try {
      await updateAdminBooking(booking.id, formData);
      router.push("/admin/bookings");
      router.refresh();
    } catch {
      setSaving(false);
    }
  }

  const hasInvoice = Boolean(booking.stripeInvoiceId);
  const customSchedule = booking.scheduleType === "custom";

  return (
    <div className="max-w-4xl space-y-6">
    <form action={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Booking details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {customSchedule && (
            <p className="rounded-md border border-copper-200 bg-copper-50 p-3 text-sm text-copper-900 sm:col-span-2">
              This booking uses custom dates. Manage its sessions in the Custom sessions panel below.
            </p>
          )}
          {customSchedule && <input type="hidden" name="offeringId" value={offeringId} />}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="offeringId">Booking type</Label>
            <select
              id="offeringId"
              name={customSchedule ? undefined : "offeringId"}
              value={offeringId}
              disabled={customSchedule}
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
            <AvailableDatePicker
              slots={slots}
              value={date}
              disabled={customSchedule || loadingSlots}
              onChange={(nextDate) => {
                const nextSlot = slots.find((slot) => slot.date === nextDate);
                const nextTime = nextSlot?.times.includes(time)
                  ? time
                  : nextSlot?.times[0] ?? "";
                setDate(nextDate);
                setTime(nextTime);
                setEndTime(keepDuration(nextSlot, nextTime, time, endTime));
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Start time</Label>
            <AvailableTimePicker
              name="time"
              value={time}
              availableTimes={availableTimes}
              startTime={selectedOffering?.facilityBookableStartTime ?? "08:00"}
              endTime={selectedOffering?.facilityBookableEndTime ?? "23:00"}
              disabled={customSchedule || loadingSlots || availableTimes.length === 0}
              onChange={(nextTime) => {
                setEndTime(keepDuration(selectedDateSlot, nextTime, time, endTime));
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
              startTime={time || selectedOffering?.facilityBookableStartTime || "08:00"}
              endTime={selectedOffering?.facilityBookableEndTime ?? "23:00"}
              disabled={customSchedule || loadingSlots || availableEndTimes.length === 0}
              onChange={setEndTime}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerGroup">Customer type</Label>
            <select
              id="customerGroup"
              name="customerGroup"
              value={customerGroup}
              onChange={(event) =>
                setCustomerGroup(event.target.value as (typeof customerGroups)[number]["value"])
              }
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
              <input
                type="checkbox"
                checked={recurring}
                disabled={customSchedule}
                onChange={(event) => setRecurrence(event.target.checked ? "weekly" : "none")}
              />
              Repeat
            </label>
          </div>

          {recurring && (
            <>
              <div className="space-y-2">
                <Label htmlFor="recurrenceFrequency">Frequency</Label>
                <select
                  id="recurrenceFrequency"
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
              <div className="space-y-2">
                <Label htmlFor="repeatCount">Number of sessions</Label>
                <Input
                  id="repeatCount"
                  type="number"
                  min="2"
                  max="52"
                  value={repeatCount}
                  onChange={(event) => setRepeatCount(Number(event.target.value))}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName">Name</Label>
            <Input id="customerName" name="customerName" defaultValue={booking.customerName} required />
          </div>
          {needsOrganisationName && (
            <div className="space-y-2">
              <Label htmlFor="organisationName">{organisationLabel}</Label>
              <Input
                id="organisationName"
                name="organisationName"
                defaultValue={booking.organisationName ?? ""}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="customerEmail">Email</Label>
            <Input id="customerEmail" name="customerEmail" type="email" defaultValue={booking.customerEmail} required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customerPhone">Phone</Label>
            <Input id="customerPhone" name="customerPhone" defaultValue={booking.customerPhone ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingLine1">Billing address line 1</Label>
            <Input id="billingLine1" name="billingLine1" defaultValue={booking.billingLine1 ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingLine2">Billing address line 2</Label>
            <Input id="billingLine2" name="billingLine2" defaultValue={booking.billingLine2 ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingCity">Town / city</Label>
            <Input id="billingCity" name="billingCity" defaultValue={booking.billingCity ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingPostcode">Postcode</Label>
            <Input id="billingPostcode" name="billingPostcode" defaultValue={booking.billingPostcode ?? ""} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={booking.notes ?? ""} rows={4} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving || loadingSlots}>
          {saving ? "Saving..." : "Save booking"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/bookings")}>
          Cancel
        </Button>
      </div>
    </form>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
          <CardDescription>
            What this booking costs against what has actually been collected.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p>
            <span className="text-muted-foreground">Price </span>
            {money(booking.amount)}
          </p>
          <p>
            <span className="text-muted-foreground">Paid </span>
            {money(booking.paidAmount)}
          </p>
          {balance !== 0 && (
            <p className={balance > 0 ? "font-medium text-destructive" : "font-medium text-primary"}>
              {balance > 0
                ? `${money(balance)} outstanding`
                : `${money(-balance)} to refund`}
            </p>
          )}
          {balance !== 0 && (
            <form action={recordBookingSettlement} className="basis-full">
              <input type="hidden" name="bookingId" value={booking.id} />
              <Button type="submit" variant="outline" size="sm">
                {balance > 0 ? "Record payment received" : "Record refund made"}
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                Use this when the difference was settled outside Stripe, by transfer or in
                person. It clears the balance without moving any money.
              </p>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice</CardTitle>
          <CardDescription>
            Send a Stripe invoice payable by card or bank transfer. Save any address
            changes first — the invoice uses the billing address above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasInvoice && (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={booking.invoiceStatus === "paid" ? "default" : "secondary"}>
                {invoiceStatusLabels[booking.invoiceStatus ?? "draft"] ?? "Invoice"}
              </Badge>
              {booking.invoiceHostedUrl && (
                <a
                  href={booking.invoiceHostedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary underline"
                >
                  View hosted invoice
                </a>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {!hasInvoice && (
              <Button type="button" onClick={handleGenerateInvoice} disabled={invoiceBusy}>
                {invoiceBusy ? "Sending invoice..." : "Generate & send invoice"}
              </Button>
            )}
            {hasInvoice && booking.invoiceStatus === "open" && (
              <>
                <Button type="button" onClick={handleGenerateInvoice} disabled={invoiceBusy}>
                  {invoiceBusy ? "Working..." : "Resend invoice"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMarkPaid}
                  disabled={invoiceBusy}
                >
                  Mark as paid (bank transfer)
                </Button>
              </>
            )}
          </div>

          {invoiceError && <p className="text-sm text-destructive">{invoiceError}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
