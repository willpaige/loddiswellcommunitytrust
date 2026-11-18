import { AlertTriangle } from "lucide-react";
import { BOOKING_TERMS, TERMS_INTRO, TERMS_VERSION } from "@/lib/booking/terms";

/** The Conditions of Hire, shared by the review dialog and /booking/terms. */
export function BookingTermsContent() {
  return (
    <>
      <p className="italic text-muted-foreground">{TERMS_INTRO}</p>
      {BOOKING_TERMS.map((section, index) => (
        <div key={index} id={section.id} className="scroll-mt-24 space-y-2 target:-mx-3 target:rounded-md target:bg-copper-50 target:px-3 target:py-2 target:text-copper-950">
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
    </>
  );
}
