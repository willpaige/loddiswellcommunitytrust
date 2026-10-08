"use client";

import { useActionState } from "react";
import { resendRequirementRequest } from "@/actions/requirement-queue";
import { Button } from "@/components/ui/button";

export function RequirementResendButton({ bookingId, requestId }: { bookingId: string; requestId: string }) {
  const [state, action, pending] = useActionState(resendRequirementRequest, { message: "", error: false });
  return <form action={action} className="space-y-2">
    <input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="requestId" value={requestId} />
    <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? "Sending…" : "Send reminder"}</Button>
    {state.message && <p role="status" className={`text-xs ${state.error ? "text-destructive" : "text-muted-foreground"}`}>{state.message}</p>}
  </form>;
}
