import { getAdminAvailability, getAdminBookingSetup } from "@/actions/bookings";
import { AvailabilityCalendar } from "@/components/booking/availability-calendar";

export const dynamic = "force-dynamic";

export default async function AdminBookingAvailabilityPage() {
  const [items, setup] = await Promise.all([
    getAdminAvailability(),
    getAdminBookingSetup(),
  ]);
  const uniqueOfferings = setup.offerings.filter(
    (offering, index, all) =>
      all.findIndex((item) => item.offeringId === offering.offeringId) === index
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Availability</h1>
        <p className="mt-1 text-muted-foreground">
          Calendar view of confirmed bookings and blocked-out venue times.
        </p>
      </div>

      <AvailabilityCalendar items={items} manualBookingOfferings={uniqueOfferings} />
    </div>
  );
}
