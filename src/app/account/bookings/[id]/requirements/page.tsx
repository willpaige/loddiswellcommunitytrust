import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { getCustomerBookingRequirements } from "@/actions/booking-requirements";
import { Button } from "@/components/ui/button";
import { AccountPortalShell } from "@/components/account/portal-shell";
import { BookingRequirementsForm } from "@/components/account/booking-requirements-form";

export const dynamic = "force-dynamic";

export default async function BookingRequirementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data;
  try {
    data = await getCustomerBookingRequirements(id);
  } catch {
    notFound();
  }
  if (!data.detail.hasRequirements) notFound();

  return (
    <AccountPortalShell
      title="Required information"
      description="Complete the questions and upload any documents needed for your booking."
    >
      <Button variant="link" asChild className="mb-4 px-0 text-muted-foreground">
        <Link href="/account/bookings">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to bookings
        </Link>
      </Button>

      <div className="mb-6">
        <h2 className="font-serif text-2xl">{data.booking.facilityName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(data.booking.startDate, "d MMM yyyy, HH:mm")}
        </p>
      </div>

      <BookingRequirementsForm
        bookingId={data.booking.id}
        detail={data.detail}
        locked={data.booking.startDatePast}
      />
    </AccountPortalShell>
  );
}
