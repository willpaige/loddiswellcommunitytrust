import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminBooking, getAdminBookingOccurrences, getAdminBookingSetup } from "@/actions/bookings";
import { getAdminBookingRequirements } from "@/actions/booking-requirements";
import { BookingEditForm } from "@/components/admin/booking-edit-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingOccurrenceActions } from "@/components/admin/booking-occurrence-actions";
import { format } from "date-fns";
import { money } from "@/lib/bookings";
import { CustomBookingScheduleEditor } from "@/components/admin/custom-booking-schedule-editor";

export const dynamic = "force-dynamic";

export default async function AdminEditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [booking, setup, requirements, occurrences] = await Promise.all([
    getAdminBooking(id),
    getAdminBookingSetup(),
    getAdminBookingRequirements(id),
    getAdminBookingOccurrences([id]),
  ]);
  if (!booking) notFound();

  // Unfiltered: an offering that has been switched off online still has existing
  // bookings, and dropping it from this list leaves the select with no matching
  // option — the form then submits no offeringId and the save throws, blocking
  // even an unrelated edit like a phone number.
  const uniqueOfferings = setup.offeringSettings.filter(
    (offering, index, all) =>
      all.findIndex((item) => item.offeringId === offering.offeringId) === index
  );

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/bookings">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to bookings
        </Link>
      </Button>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit booking</h1>
        <p className="mt-1 text-muted-foreground">
          Change the date, time, repeat count, and customer details.
        </p>
      </div>
      <BookingEditForm
        booking={{
          ...booking,
          offeringId: booking.offeringId,
          customerGroup: booking.customerGroup,
        }}
        offerings={uniqueOfferings}
      />

      {booking.scheduleType === "custom" && (
        <Card className="mt-6 max-w-4xl">
          <CardHeader><CardTitle>Custom sessions</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {occurrences.map((occurrence) => (
                <li key={occurrence.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div>
                    <p className={occurrence.status === "cancelled" ? "line-through text-muted-foreground" : "font-medium"}>
                      {format(occurrence.startDate, "d MMMM yyyy, HH:mm")}–{format(occurrence.endDate, "HH:mm")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {money(occurrence.allocatedAmount)} · {occurrence.status}
                      {occurrence.refundStatus !== "none" && ` · refund ${occurrence.refundStatus}`}
                    </p>
                  </div>
                  <BookingOccurrenceActions
                    occurrenceId={occurrence.id}
                    cancelled={occurrence.status === "cancelled"}
                    refundDue={occurrence.refundStatus === "due"}
                  />
                </li>
              ))}
            </ul>
            {booking.offeringId && (() => {
              const selected = uniqueOfferings.find((item) => item.offeringId === booking.offeringId);
              return selected ? (
                <CustomBookingScheduleEditor
                  bookingId={booking.id}
                  offeringId={booking.offeringId}
                  bookableStartTime={selected.facilityBookableStartTime}
                  bookableEndTime={selected.facilityBookableEndTime}
                  occurrences={occurrences}
                />
              ) : null;
            })()}
          </CardContent>
        </Card>
      )}

      {requirements?.hasRequirements && (
        <Card className="mt-6 max-w-4xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Required information
              <Badge variant={requirements.complete ? "default" : "destructive"}>
                {requirements.complete ? "Complete" : "Outstanding"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {requirements.questions.map((question) => (
              <div key={question.questionId} className="border-b pb-3 last:border-b-0 last:pb-0">
                <p className="text-sm font-medium">{question.label}</p>
                <p className="text-sm text-muted-foreground">
                  {question.type === "yes_no"
                    ? question.answerBool === true
                      ? "Yes"
                      : question.answerBool === false
                        ? "No"
                        : "Not answered"
                    : question.answerText || "Not answered"}
                </p>
                {question.needsDocument && (
                  <div className="mt-2">
                    {question.documents.length > 0 ? (
                      <ul className="space-y-1">
                        {question.documents.map((doc) => (
                          <li key={doc.id}>
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary underline"
                            >
                              {question.documentLabel || "Document"}: {doc.fileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-destructive">
                        {question.documentLabel || "Document"} not uploaded
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
