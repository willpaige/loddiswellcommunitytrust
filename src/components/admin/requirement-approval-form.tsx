"use client";

import { useActionState } from "react";
import { setBookingRequirementApproval } from "@/actions/booking-requirements";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RequirementApprovalForm({ bookingId, approved }: { bookingId: string; approved: boolean }) {
  const [state, action, pending] = useActionState(setBookingRequirementApproval, { message: "", error: false });
  return <form action={action} className="space-y-3 rounded-md border p-4">
    <input type="hidden" name="bookingId" value={bookingId} />
    <input type="hidden" name="intent" value={approved ? "revoke" : "approve"} />
    <p className="text-sm">{approved ? "Remove the offline sign-off if this booking needs further information." : "If you have checked the required information and documents offline, sign off this booking to stop reminders for all its sessions."}</p>
    <Label htmlFor="approval-note">Reason for {approved ? "reopening" : "sign-off"}</Label>
    <Textarea id="approval-note" name="note" required minLength={5} maxLength={2000} disabled={pending} />
    <Button type="submit" variant="outline" disabled={pending}>{pending ? "Saving…" : approved ? "Reopen required information" : "Information checked offline"}</Button>
    {state.message && <p role={state.error ? "alert" : "status"} className={`text-sm ${state.error ? "text-destructive" : "text-muted-foreground"}`}>{state.message}</p>}
  </form>;
}
