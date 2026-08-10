import { format } from "date-fns";
import { Ban, Pencil } from "lucide-react";
import {
  deleteBookingBlock,
  deleteBookingBlockSeries,
  getAdminBookingSetup,
  updateBookingCancellationSettings,
  updateRepeatBookingDiscount,
  updateFacilityBookableHours,
} from "@/actions/bookings";
import {
  assignRequirementSetToOffering,
  getAdminOfferingsForRequirements,
  getRequirementSets,
} from "@/actions/booking-requirements";
import { bookingHourOptions, capacityUnitNoun, recurrenceLabel } from "@/lib/bookings";
import { BookingBlockForm } from "@/components/admin/booking-block-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { BookingPricesTable } from "@/components/admin/booking-prices-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function AdminBookingSettingsPage() {
  const [setup, requirementOfferings, requirementSets] = await Promise.all([
    getAdminBookingSetup(),
    getAdminOfferingsForRequirements(),
    getRequirementSets(),
  ]);
  const uniqueOfferings = setup.offerings.filter(
    (offering, index, all) =>
      all.findIndex((item) => item.offeringId === offering.offeringId) === index
  );
  // Derived from the UNFILTERED offering list: a venue must stay blockable even
  // when its offerings are switched off for the season, and falling back to the
  // active-only feed would drop it from the form and silently default the admin
  // to a different venue. A block closes the whole venue, so its capacity
  // ceiling is the largest any of that venue's offerings has.
  const facilities = setup.offeringSettings
    .filter(
      (offering, index, all) =>
        all.findIndex((item) => item.facilityId === offering.facilityId) === index
    )
    .map((facility) => ({
      facilityId: facility.facilityId,
      facilityName: facility.facilityName,
      facilitySlug: facility.facilitySlug,
      facilityBookableStartTime: facility.facilityBookableStartTime,
      facilityBookableEndTime: facility.facilityBookableEndTime,
      capacity: Math.max(
        1,
        ...setup.offeringSettings
          .filter((item) => item.facilityId === facility.facilityId)
          .map((item) => item.capacity)
      ),
    }));
  const displayedBlocks = setup.blocks.filter((block) => {
    if (!block.seriesId) return true;
    const seriesBlocks = setup.blocks.filter((item) => item.seriesId === block.seriesId);
    const first = seriesBlocks.reduce((earliest, item) =>
      item.startDate < earliest.startDate ? item : earliest
    );
    return first.id === block.id;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Booking Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage bookable times, block-outs, and prices.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Repeat booking discount</CardTitle>
            <CardDescription>
              Advertised on repeat bookings and applied automatically at checkout.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateRepeatBookingDiscount} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="repeatThreshold">Bookings required</Label>
                <Input
                  id="repeatThreshold"
                  name="threshold"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={setup.repeatDiscount.threshold}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repeatPercent">Discount percent</Label>
                <Input
                  id="repeatPercent"
                  name="percent"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  defaultValue={setup.repeatDiscount.percent}
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="outline">
                  Save discount
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer cancellations</CardTitle>
            <CardDescription>
              Allow customers to cancel online and automatically refund eligible card payments until this many hours before the booking starts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateBookingCancellationSettings} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cancellationNoticeHours">Notice required</Label>
                <Input
                  id="cancellationNoticeHours"
                  name="noticeHours"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={setup.cancellationSettings.noticeHours}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Hours before start time. Use 0 to allow cancellation until the booking starts.
                </p>
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="outline">
                  Save cancellation policy
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bookable times</CardTitle>
            <CardDescription>
              Set the public booking window for each venue. Bookings must start and end inside these hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {facilities.map((facility) => (
              <form key={facility.facilityId} action={updateFacilityBookableHours} className="rounded-md border p-4">
                <input type="hidden" name="facilityId" value={facility.facilityId} />
                <h2 className="font-medium">{facility.facilityName}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${facility.facilityId}-start`}>From</Label>
                    <select
                      id={`${facility.facilityId}-start`}
                      name="bookableStartTime"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      defaultValue={facility.facilityBookableStartTime}
                    >
                      {bookingHourOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${facility.facilityId}-end`}>Until</Label>
                    <select
                      id={`${facility.facilityId}-end`}
                      name="bookableEndTime"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      defaultValue={facility.facilityBookableEndTime}
                    >
                      {bookingHourOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button type="submit" variant="outline" className="mt-4 w-full">
                  Save times
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" aria-hidden="true" />
              Block out time
            </CardTitle>
            <CardDescription>Make a venue unavailable for maintenance, closures, or Trust events.</CardDescription>
          </CardHeader>
          <CardContent>
            <BookingBlockForm facilities={facilities} />
            <div className="mt-8 border-t pt-6">
              <h3 className="font-medium">Existing block-outs</h3>
              {displayedBlocks.length ? (
                <ul className="mt-3 divide-y rounded-md border">
                  {displayedBlocks.map((block) => (
                    <li key={block.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <p className="font-medium">{block.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {block.facilityName} · {format(block.startDate, "d MMM yyyy, HH:mm")}–{format(block.endDate, "d MMM yyyy, HH:mm")}
                        </p>
                        {block.capacity && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Blocks {block.capacity} {capacityUnitNoun(block.facilitySlug, block.capacity)}
                          </p>
                        )}
                        {block.seriesId && block.recurrence && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Repeats {recurrenceLabel(block.recurrence).toLowerCase()}
                            {block.indefinite ? " indefinitely" : ` · ${block.repeatCount} blocks total`}
                          </p>
                        )}
                      </div>
                      {block.seriesId ? (
                        <DeleteButton id={block.seriesId} action={deleteBookingBlockSeries} label={`Delete all ${block.title} block-outs`} description="This removes every occurrence in this recurring block-out series. This cannot be undone." />
                      ) : (
                        <DeleteButton id={block.id} action={deleteBookingBlock} label={`Delete ${block.title}`} description="This removes this blocked-out occurrence. This cannot be undone." />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No blocked-out times have been added.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" aria-hidden="true" />
              Prices
            </CardTitle>
            <CardDescription>Prices are stored in pounds and used by Stripe Checkout.</CardDescription>
          </CardHeader>
          <CardContent>
            <BookingPricesTable rows={setup.offeringSettings} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requirement questionnaires</CardTitle>
            <CardDescription>
              Assign a questionnaire to a booking type. Customers complete it after booking;
              build sets on the{" "}
              <a className="underline" href="/admin/bookings/requirements">
                Requirements
              </a>{" "}
              page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {requirementOfferings.map((offering) => (
              <form
                key={offering.id}
                action={assignRequirementSetToOffering}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <input type="hidden" name="offeringId" value={offering.id} />
                <div className="text-sm">
                  <span className="font-medium">{offering.facilityName}</span> — {offering.name}
                  {!offering.active && <span className="ml-2 text-muted-foreground">(inactive)</span>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    name="requirementSetId"
                    defaultValue={offering.requirementSetId ?? ""}
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">No questionnaire</option>
                    {requirementSets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline" size="sm">
                    Save
                  </Button>
                </div>
              </form>
            ))}
            {requirementOfferings.length === 0 && (
              <p className="text-sm text-muted-foreground">No booking types found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
