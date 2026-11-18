ALTER TABLE "bookings" ADD COLUMN "payment_due_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_last_call_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "released_unpaid_at" timestamp;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "unpaid_booking_hold_days" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
-- Bookings already sitting unpaid get the same hold from today: three days, or
-- until 24 hours before the session if that's sooner (never less than two
-- hours). They were chased by email when this shipped, so the first reminder
-- counts as sent and only the last call and release remain.
UPDATE "bookings"
SET "payment_due_at" = LEAST("start_date", GREATEST(now() + interval '2 hours', LEAST(now() + interval '3 days', "start_date" - interval '24 hours'))),
    "payment_reminder_sent_at" = now()
WHERE "status" = 'pending_payment'
  AND "payment_type" IN ('one_off', 'subscription')
  AND "stripe_checkout_session_id" IS NOT NULL
  AND "payment_due_at" IS NULL
  AND "start_date" > now();
