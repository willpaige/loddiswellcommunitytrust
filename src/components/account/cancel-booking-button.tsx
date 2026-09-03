"use client";

import { cancelCustomerBooking } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Cancelling refunds the card and releases the slot, and neither can be undone
// from here, so it always asks first.
export function CustomerCancelBookingButton({
  bookingId,
  facilityName,
  schedule,
  refundText,
}: {
  bookingId: string;
  facilityName: string;
  schedule: string;
  refundText: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline">
          Cancel booking
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            {facilityName} on {schedule} will be released for others to book. {refundText}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={cancelCustomerBooking}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive">
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
