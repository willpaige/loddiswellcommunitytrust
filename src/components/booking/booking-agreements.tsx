"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookingTermsContent } from "@/components/booking/booking-terms-content";
import {
  DAMAGE_CLAUSE_PATH,
  LEAVE_AS_FOUND_DETAIL,
  LEAVE_AS_FOUND_LABEL,
  TERMS_VERSION,
} from "@/lib/booking/terms";

/**
 * The "Before you book" confirmations on the review page. The terms box is
 * always asked; the leave-as-found box only for facilities that require it.
 * The server checks both again, so this is guidance rather than the guard.
 */
export function BookingAgreements({
  leaveAsFoundRequired,
  submitLabel,
  initialError,
}: {
  leaveAsFoundRequired: boolean;
  submitLabel: string;
  initialError?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [readTerms, setReadTerms] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [venueCare, setVenueCare] = useState(false);
  const [attempted, setAttempted] = useState(Boolean(initialError));

  const termsMissing = !termsAccepted;
  const venueMissing = leaveAsFoundRequired && !venueCare;
  const ready = !termsMissing && !venueMissing;

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 32) setReachedEnd(true);
  }

  function acceptFromDialog() {
    setReadTerms(true);
    setTermsAccepted(true);
    setDialogOpen(false);
  }

  return (
    <div className="space-y-4">
      <fieldset
        className={`space-y-4 rounded-md border p-4 ${
          attempted && !ready ? "border-destructive" : ""
        }`}
      >
        <legend className="px-1 text-sm font-semibold">Before you book</legend>

        <div className="flex items-start gap-3">
          <Checkbox
            id="termsAcceptedBox"
            checked={termsAccepted}
            disabled={!readTerms}
            onCheckedChange={(value) => setTermsAccepted(value === true)}
            aria-describedby="termsAcceptedHint"
            className="mt-0.5"
          />
          <div className="space-y-1 text-sm">
            <label htmlFor="termsAcceptedBox" className={readTerms ? "" : "text-muted-foreground"}>
              I have read and accept the{" "}
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="font-medium text-primary underline underline-offset-2"
              >
                Terms and Conditions of Hire
              </button>
              , including the availability disclaimer, on behalf of the Hirer.
            </label>
            <p id="termsAcceptedHint" className="text-xs text-muted-foreground">
              {readTerms
                ? `Conditions of Hire, ${TERMS_VERSION}.`
                : "Open the terms and read them to the end to tick this box."}
            </p>
            {attempted && termsMissing && (
              <p className="text-xs font-medium text-destructive" role="alert">
                Read and accept the Terms and Conditions of Hire to continue.
              </p>
            )}
          </div>
        </div>

        {leaveAsFoundRequired && (
          <div className="flex items-start gap-3">
            <Checkbox
              id="venueCareBox"
              checked={venueCare}
              onCheckedChange={(value) => setVenueCare(value === true)}
              aria-describedby="venueCareHint"
              className="mt-0.5"
            />
            <div className="space-y-1 text-sm">
              <label htmlFor="venueCareBox">{LEAVE_AS_FOUND_LABEL}</label>
              <p id="venueCareHint" className="text-xs text-muted-foreground">
                {LEAVE_AS_FOUND_DETAIL} Any damage is covered by the{" "}
                <a
                  href={DAMAGE_CLAUSE_PATH}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  damage clause
                </a>{" "}
                of the hire conditions.
              </p>
              {attempted && venueMissing && (
                <p className="text-xs font-medium text-destructive" role="alert">
                  Tick this box to confirm you&apos;ll leave the venue as you found it.
                </p>
              )}
            </div>
          </div>
        )}

        {termsAccepted && <input type="hidden" name="termsAccepted" value="true" />}
        {leaveAsFoundRequired && venueCare && (
          <input type="hidden" name="venueCareConfirmed" value="true" />
        )}
      </fieldset>

      <Button
        type="submit"
        className="w-full sm:w-auto"
        aria-disabled={!ready}
        onClick={(event) => {
          if (!ready) {
            event.preventDefault();
            setAttempted(true);
          }
        }}
      >
        {submitLabel}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Terms and Conditions of Hire</DialogTitle>
            <DialogDescription>
              Please read these conditions in full. Scroll to the bottom to accept them.
            </DialogDescription>
          </DialogHeader>
          <div
            onScroll={handleScroll}
            ref={(el) => {
              // On a tall screen the terms may fit without scrolling.
              if (el && el.scrollHeight - el.clientHeight < 32) setReachedEnd(true);
            }}
            className="max-h-[55vh] space-y-4 overflow-y-auto rounded-md border bg-muted/30 p-4 text-sm leading-relaxed"
          >
            <BookingTermsContent />
          </div>
          {!reachedEnd && (
            <p className="rounded-md bg-copper-50 px-3 py-2 text-xs font-medium text-copper-800">
              Scroll through all of the terms to accept them.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            <Button type="button" disabled={!reachedEnd} onClick={acceptFromDialog}>
              I accept these terms
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
