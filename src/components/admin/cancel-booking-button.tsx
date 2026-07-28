"use client";

import { cancelAdminBooking } from "@/actions/bookings";
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

type CancelBookingButtonProps = {
  bookingId: string;
  customerName: string;
  facilityName: string;
  insideCancellationWindow: boolean;
  canRefund: boolean;
};

export function CancelBookingButton({
  bookingId,
  customerName,
  facilityName,
  insideCancellationWindow,
  canRefund,
}: CancelBookingButtonProps) {
  if (!insideCancellationWindow) {
    return (
      <form action={cancelAdminBooking}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <Button type="submit" variant="ghost" size="sm">
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            The {facilityName} booking for {customerName} is inside the no-cancellation
            notice period. Choose whether to refund its card payment.
            {!canRefund && " This booking has no refundable one-off card payment."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={cancelAdminBooking}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              name="refund"
              value="false"
              variant="outline"
            >
              Cancel only
            </AlertDialogAction>
            <AlertDialogAction
              type="submit"
              name="refund"
              value="true"
              variant="destructive"
              disabled={!canRefund}
            >
              Cancel and refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
