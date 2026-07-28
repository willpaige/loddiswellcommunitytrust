ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "booking_cancellation_notice_hours" integer DEFAULT 48 NOT NULL;
