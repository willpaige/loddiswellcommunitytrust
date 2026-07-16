"use client";

import { cancelAdminBookingOccurrence, markOccurrenceRefunded } from "@/actions/bookings";
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

export function BookingOccurrenceActions({
  occurrenceId,
  cancelled,
  refundDue,
}: {
  occurrenceId: string;
  cancelled: boolean;
  refundDue: boolean;
}) {
  if (refundDue) {
    return (
      <form action={markOccurrenceRefunded}>
        <input type="hidden" name="occurrenceId" value={occurrenceId} />
        <Button type="submit" variant="outline" size="sm">Mark refunded</Button>
      </form>
    );
  }
  if (cancelled) return null;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">Cancel session</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
          <AlertDialogDescription>
            Only this date will be cancelled. Eligible card payments are refunded pro rata;
            paid invoice refunds are recorded as due.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={cancelAdminBookingOccurrence}>
          <input type="hidden" name="occurrenceId" value={occurrenceId} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep session</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive">Cancel session</AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
