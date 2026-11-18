ALTER TABLE "bookings" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "terms_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "venue_care_confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "leave_as_found_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Hirers of the Village Hall and Pavilion confirm they'll leave the venue as
-- they found it. The tennis courts and other facilities don't ask.
UPDATE "facilities" SET "leave_as_found_required" = true WHERE "slug" IN ('village-hall', 'pavilion');
--> statement-breakpoint
-- Carry that confirmation into the booking emails. {{venueCareNotice}} is
-- empty for facilities that don't ask, so other bookings are unchanged. It
-- goes just before {{requirementsNotice}} where a template has one, otherwise
-- at the end, and templates that already mention it are left alone.
UPDATE "email_templates"
SET "body" = CASE
      WHEN "body" LIKE '%{{requirementsNotice}}%'
        THEN replace("body", '{{requirementsNotice}}', E'{{venueCareNotice}}\n\n{{requirementsNotice}}')
      ELSE "body" || E'\n\n{{venueCareNotice}}'
    END,
    "variables" = "variables" || '["venueCareNotice"]'::jsonb,
    "updated_at" = now()
WHERE "key" IN ('booking_confirmation', 'booking_reminder', 'booking_changed', 'manual_booking_confirmation')
  AND "body" NOT LIKE '%{{venueCareNotice}}%';
--> statement-breakpoint
UPDATE "email_templates"
SET "body" = "body" || E'\n\n{{agreementRecord}}',
    "variables" = "variables" || '["agreementRecord"]'::jsonb,
    "updated_at" = now()
WHERE "key" = 'booking_manager_notification'
  AND "body" NOT LIKE '%{{agreementRecord}}%';
