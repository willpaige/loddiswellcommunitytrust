"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
import { BOOKING_TERMS, TERMS_INTRO, TERMS_VERSION } from "@/lib/booking/terms";

export function BookingTermsButton() {
  const [open, setOpen] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [confirmationHint, setConfirmationHint] = useState("");
  const submitRef = useRef<HTMLButtonElement>(null);

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 32) {
      setReachedEnd(true);
      setConfirmationHint("You’ve reached the end. Tick the acceptance box to continue.");
    }
  }

  function handleConfirm() {
    if (!reachedEnd) {
      setConfirmationHint("Please scroll through all of the terms before confirming.");
      return;
    }
    if (!accepted) {
      setConfirmationHint("Please tick the acceptance box before continuing.");
      return;
    }
    setOpen(false);
    // Submit the surrounding booking form to continue to Stripe checkout.
    submitRef.current?.click();
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Book now
      </Button>
      <button
        ref={submitRef}
        type="submit"
        name="termsAccepted"
        value="true"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Terms and Conditions of Hire</DialogTitle>
            <DialogDescription>
              Please read these conditions in full. Scroll to the bottom to enable
              acceptance, then confirm to continue to payment.
            </DialogDescription>
          </DialogHeader>

          <div
            onScroll={handleScroll}
            className="max-h-[55vh] space-y-4 overflow-y-auto rounded-md border bg-muted/30 p-4 text-sm leading-relaxed"
          >
            <p className="italic text-muted-foreground">{TERMS_INTRO}</p>
            {BOOKING_TERMS.map((section, index) => (
              <div key={index} className="space-y-2">
                {section.heading && (
                  <h3 className="font-semibold text-foreground">{section.heading}</h3>
                )}
                {section.paragraphs?.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
                {section.bullets && (
                  <ul className="list-disc space-y-1 pl-5">
                    {section.bullets.map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <h3 className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Availability disclaimer
              </h3>
              <p className="mt-2">
                We make every effort to keep our booking calendar accurate. In the
                unlikely event that an administrative error or a previously arranged
                event creates a clash, the Trust may need to change or cancel your
                booking. We will contact you as soon as possible and offer a suitable
                alternative date or a full refund.
              </p>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Loddiswell Playing Fields and Village Hall Trust — Conditions of Hire,
              amended {TERMS_VERSION}.
            </p>
          </div>

          <label
            className={`flex items-start gap-3 text-sm ${
              reachedEnd ? "" : "opacity-50"
            }`}
          >
            <Checkbox
              checked={accepted}
              onCheckedChange={(value) => {
                setAccepted(value === true);
                if (value === true) setConfirmationHint("");
              }}
              disabled={!reachedEnd}
              className="mt-0.5"
            />
            <span>
              I have read and accept the Terms and Conditions of Hire, including the
              availability disclaimer, on behalf of the Hirer.
            </span>
          </label>
          {!reachedEnd && (
            <p className="rounded-md bg-copper-50 px-3 py-2 text-xs font-medium text-copper-800">
              Scroll through all of the terms to unlock the acceptance box.
            </p>
          )}
          {confirmationHint && (
            <p className="text-xs font-medium text-copper-700" role="status" aria-live="polite">
              {confirmationHint}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              aria-disabled={!accepted}
              title={
                !reachedEnd
                  ? "Please scroll through all of the terms before confirming"
                  : !accepted
                    ? "Tick the acceptance box before continuing"
                    : undefined
              }
              className={!accepted ? "cursor-help opacity-50" : undefined}
              onClick={handleConfirm}
            >
              Accept and continue to payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
