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
type RefundKind = "card" | "manual" | "subscription" | "none";

// What cancelling actually does with the money, in the same words the action
// will follow: only a one-off card payment comes back automatically.
function refundText(kind: RefundKind, amount: string) {
  switch (kind) {
    case "card":
      return `${amount} will be refunded to the card you paid with. Refunds usually reach your account within five to ten working days.`;
    case "manual":
      return `${amount} has been paid for this booking. We cannot refund it automatically, so the Trust will contact you to arrange it.`;
    case "subscription":
      return "Your subscription will be cancelled and no further payments taken. Payments already made are not refunded automatically — the Trust will contact you.";
    default:
      return "No payment has been taken for this booking, so there is nothing to refund.";
  }
}

export function CustomerCancelBookingButton({
  bookingId,
  facilityName,
  schedule,
  refundKind,
  paidAmount,
}: {
  bookingId: string;
  facilityName: string;
  schedule: string;
  refundKind: RefundKind;
  paidAmount: string;
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
            {facilityName} on {schedule} will be released for others to book, and this
            cannot be undone. {refundText(refundKind, paidAmount)}
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
