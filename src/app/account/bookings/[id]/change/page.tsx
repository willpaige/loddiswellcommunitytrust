import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCustomerBookingChange, getPublicBookingData } from "@/actions/bookings";
import { AccountPortalShell } from "@/components/account/portal-shell";
import { BookingChangeForm } from "@/components/account/booking-change-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ChangeBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getCustomerBookingChange>> | null = null;
  let error: string | null = null;
  try {
    data = await getCustomerBookingChange(id);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "This booking cannot be changed online.";
  }

  const setup = await getPublicBookingData();
  const facility = setup.offerings.find(
    (offering) => offering.facilityName === data?.booking.facilityName
  );

  return (
    <AccountPortalShell
      title="Change your booking"
      description="Move your booking to another time. We will settle any difference in price for you."
    >
      <Button variant="link" asChild className="mb-4 px-0 text-muted-foreground">
        <Link href="/account/bookings">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to bookings
        </Link>
      </Button>

      {error || !data ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm">{error}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Please contact the Trust and we will sort it out with you.
          </p>
        </div>
      ) : (
        <BookingChangeForm
          booking={data.booking}
          slots={data.slots}
          bookableStartTime={facility?.facilityBookableStartTime ?? "08:00"}
          bookableEndTime={facility?.facilityBookableEndTime ?? "23:00"}
        />
      )}
    </AccountPortalShell>
  );
}
