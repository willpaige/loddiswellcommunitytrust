"use client";

import { Pencil } from "lucide-react";
import { updateBookingPrice } from "@/actions/bookings";
import { customerGroups, money } from "@/lib/bookings";
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

type BookingPriceRow = {
  facilityName: string;
  offeringId: string;
  offeringName: string;
  customerGroup: string;
  amount: number;
};

type OfferingSummary = {
  facilityName: string;
  offeringId: string;
  offeringName: string;
  prices: BookingPriceRow[];
};

type FacilitySummary = {
  facilityName: string;
  offerings: OfferingSummary[];
};

function groupOfferings(rows: BookingPriceRow[]) {
  const map = new Map<string, OfferingSummary>();
  rows.forEach((row) => {
    if (!map.has(row.offeringId)) {
      map.set(row.offeringId, {
        facilityName: row.facilityName,
        offeringId: row.offeringId,
        offeringName: row.offeringName,
        prices: [],
      });
    }
    map.get(row.offeringId)?.prices.push(row);
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

export function BookingPricesTable({ rows }: { rows: BookingPriceRow[] }) {
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
                            <DialogTitle>Edit prices</DialogTitle>
                            <DialogDescription>
                              {offering.facilityName} - {offering.offeringName}
                            </DialogDescription>
                          </DialogHeader>
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
