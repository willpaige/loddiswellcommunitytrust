"use client";

import { useRef, useState } from "react";
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
  const submitRef = useRef<HTMLButtonElement>(null);

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 32) {
      setReachedEnd(true);
    }
  }

  function handleConfirm() {
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
              onCheckedChange={(value) => setAccepted(value === true)}
              disabled={!reachedEnd}
              className="mt-0.5"
            />
            <span>
              I have read and accept the Terms and Conditions of Hire on behalf of the
              Hirer.
            </span>
          </label>
          {!reachedEnd && (
            <p className="text-xs text-muted-foreground">
              Scroll to the end of the terms to continue.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!accepted} onClick={handleConfirm}>
              Accept and continue to payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
