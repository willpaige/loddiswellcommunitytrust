"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
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
import { sendDrawNotifications } from "@/actions/lottery-admin";

type Props = {
  drawId: string;
  recipientCount: number;
  notifiedAt: Date | null;
};

export function SendDrawNotificationsButton({
  drawId,
  recipientCount,
  notifiedAt,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setLoading(true);
    setError(null);
    try {
      const r = await sendDrawNotifications(drawId);
      if (r.alreadySent) {
        setResult("This draw was already notified.");
      } else if (r.failed > 0) {
        setResult(
          `Sent to ${r.sent} subscriber${r.sent === 1 ? "" : "s"}; ${r.failed} address${r.failed === 1 ? "" : "es"} could not be delivered to (see email log).`
        );
      } else {
        setResult(`Sent to ${r.sent} subscriber${r.sent === 1 ? "" : "s"}.`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setLoading(false);
    }
  }

  if (notifiedAt) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2
          className="h-4 w-4 text-sage-600"
          aria-hidden="true"
        />
        Notifications sent {new Date(notifiedAt).toLocaleString("en-GB")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={loading} className="bg-sage-700 hover:bg-sage-800">
            {loading ? (
              <>
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" aria-hidden="true" />
                Send notifications
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send draw notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              An email with the winners will be sent to{" "}
              <strong>{recipientCount}</strong> active subscriber
              {recipientCount === 1 ? "" : "s"}. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              className="bg-sage-700 hover:bg-sage-800 text-white"
            >
              Send to {recipientCount} subscriber
              {recipientCount === 1 ? "" : "s"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {result && (
        <p className="text-sm text-sage-700" role="status">
          {result}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
