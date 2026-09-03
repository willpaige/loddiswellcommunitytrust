"use client";

import { X } from "lucide-react";
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
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label={`Cancel booking for ${customerName}`}
          title="Cancel booking"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            {insideCancellationWindow
              ? `The ${facilityName} booking for ${customerName} is inside the no-cancellation notice period. Choose whether to refund its card payment.${
                  canRefund ? "" : " This booking has no refundable one-off card payment."
                }`
              : `The ${facilityName} booking for ${customerName} will be marked cancelled and its sessions released. The booking itself is kept on record.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={cancelAdminBooking}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            {insideCancellationWindow ? (
              <>
                <AlertDialogAction type="submit" name="refund" value="false" variant="outline">
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
              </>
            ) : (
              <AlertDialogAction type="submit" name="refund" value="false" variant="destructive">
                Cancel booking
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
