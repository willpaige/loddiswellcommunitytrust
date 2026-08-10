"use client";

import { useActionState } from "react";
import { Pencil } from "lucide-react";
import { updateBookingOffering, updateBookingPrice } from "@/actions/bookings";
import { capacityUnitNoun, customerGroups, money } from "@/lib/bookings";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// One row per offering x customer group, from the UNFILTERED admin query. Both
// the offering settings and the prices must come from the same source: joining
// prices from the active-only public feed made a deactivated offering render
// £0.00 across the board, which the Edit dialog would then happily save.
type OfferingSettingRow = {
  offeringId: string;
  offeringName: string;
  facilityId: string;
  facilityName: string;
  facilitySlug: string;
  capacity: number;
  active: boolean;
  customerGroup: string | null;
  amount: number | null;
};

type OfferingSummary = {
  offeringId: string;
  offeringName: string;
  facilityId: string;
  facilityName: string;
  facilitySlug: string;
  capacity: number;
  active: boolean;
  prices: Array<{ customerGroup: string; amount: number }>;
};

type FacilitySummary = {
  facilityName: string;
  offerings: OfferingSummary[];
};

function groupOfferings(rows: OfferingSettingRow[]) {
  const map = new Map<string, OfferingSummary>();
  rows.forEach((row) => {
    if (!map.has(row.offeringId)) {
      const { customerGroup, amount, ...offering } = row;
      void customerGroup;
      void amount;
      map.set(row.offeringId, { ...offering, prices: [] });
    }
    if (row.customerGroup !== null && row.amount !== null) {
      map.get(row.offeringId)?.prices.push({
        customerGroup: row.customerGroup,
        amount: row.amount,
      });
    }
  });
  return Array.from(map.values());
}

function groupByFacility(offerings: OfferingSummary[]) {
  const map = new Map<string, FacilitySummary>();
  offerings.forEach((offering) => {
    if (!map.has(offering.facilityName)) {
      map.set(offering.facilityName, {
        facilityName: offering.facilityName,
        offerings: [],
      });
    }
    map.get(offering.facilityName)?.offerings.push(offering);
  });
  return Array.from(map.values());
}

function amountFor(offering: OfferingSummary, group: string) {
  return offering.prices.find((price) => price.customerGroup === group)?.amount ?? 0;
}

function baseAmount(offering: OfferingSummary) {
  return amountFor(offering, "parent_private");
}

function overrides(offering: OfferingSummary) {
  const base = baseAmount(offering);
  return customerGroups
    .filter((group) => group.value !== "parent_private")
    .map((group) => ({
      label: group.label,
      amount: amountFor(offering, group.value),
    }))
    .filter((override) => override.amount !== base);
}

// Its own component so useActionState can hold per-offering form state; the
// dialogs are rendered inside a map, where a hook could not live.
function OfferingSettingsForm({ offering }: { offering: OfferingSummary }) {
  const [state, formAction] = useActionState(updateBookingOffering, {});

  return (
    <form action={formAction} className="rounded-md border p-3">
      <input type="hidden" name="offeringId" value={offering.offeringId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${offering.offeringId}-capacity`}>Capacity</Label>
          <Input
            id={`${offering.offeringId}-capacity`}
            name="capacity"
            type="number"
            min="1"
            max="50"
            step="1"
            required
            defaultValue={offering.capacity}
            className="w-28"
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={offering.active} />
          Bookable online
        </label>
        <PendingSubmitButton idleLabel="Save settings" pendingLabel="Saving..." />
      </div>
      {state.error ? (
        <p className="mt-2 text-xs text-destructive">{state.error}</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          How many bookings can run at once — e.g. 2 tennis courts.
        </p>
      )}
    </form>
  );
}

export function BookingPricesTable({ rows }: { rows: OfferingSettingRow[] }) {
  const facilities = groupByFacility(groupOfferings(rows));

  return (
    <div className="space-y-8">
      {facilities.map((facility) => (
        <section key={facility.facilityName}>
          <h3 className="mb-3 font-serif text-xl">{facility.facilityName}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking type</TableHead>
                <TableHead>Base price</TableHead>
                <TableHead>Overrides</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facility.offerings.map((offering) => {
                const offeringOverrides = overrides(offering);
                return (
                  <TableRow key={offering.offeringId}>
                    <TableCell>
                      <p className="font-medium">{offering.offeringName}</p>
                      {(offering.capacity > 1 || !offering.active) && (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {offering.capacity > 1 && (
                            <Badge variant="secondary">
                              {offering.capacity}{" "}
                              {capacityUnitNoun(offering.facilitySlug, offering.capacity)}
                            </Badge>
                          )}
                          {!offering.active && <Badge variant="outline">Inactive</Badge>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{money(baseAmount(offering))}</TableCell>
                    <TableCell>
                      {offeringOverrides.length === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {offeringOverrides.map((override) => (
                            <Badge key={override.label} variant="outline">
                              {override.label}: {money(override.amount)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit booking type</DialogTitle>
                            <DialogDescription>
                              {offering.facilityName} - {offering.offeringName}
                            </DialogDescription>
                          </DialogHeader>
                          {/* Sibling of the price forms, never nested — HTML forbids nested forms. */}
                          <OfferingSettingsForm offering={offering} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            {customerGroups.map((group) => {
                              const price = amountFor(offering, group.value);
                              return (
                                <form
                                  key={group.value}
                                  action={updateBookingPrice}
                                  className="rounded-md border p-3"
                                >
                                  <input type="hidden" name="offeringId" value={offering.offeringId} />
                                  <input type="hidden" name="customerGroup" value={group.value} />
                                  <Label htmlFor={`${offering.offeringId}-${group.value}`}>
                                    {group.label}
                                  </Label>
                                  <div className="mt-2 flex gap-2">
                                    <Input
                                      id={`${offering.offeringId}-${group.value}`}
                                      name="amount"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      defaultValue={(price / 100).toFixed(2)}
                                    />
                                    <Button type="submit" variant="outline">
                                      Save
                                    </Button>
                                  </div>
                                </form>
                              );
                            })}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      ))}
    </div>
  );
}
