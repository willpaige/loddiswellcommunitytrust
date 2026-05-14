"use client";

import { useState } from "react";
import { CalendarOff, Loader2 } from "lucide-react";
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
import { cancelSubscription } from "@/actions/lottery-admin";

type Props = {
  id: string;
  subscriberLabel: string;
  periodEnd?: string;
};

export function CancelSubscriptionButton({
  id,
  subscriberLabel,
  periodEnd,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      await cancelSubscription(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
      setLoading(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Cancel subscription"
          title="Cancel subscription"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CalendarOff className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
          <AlertDialogDescription>
            {subscriberLabel}&apos;s subscription will be set to cancel at the
            end of the current billing period
            {periodEnd ? ` (${periodEnd})` : ""}. They&apos;ll keep their tickets
            in draws until then. They can resubscribe at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep subscription</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Cancel at period end
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
