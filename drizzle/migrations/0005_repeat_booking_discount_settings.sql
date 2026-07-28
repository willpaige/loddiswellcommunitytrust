ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "repeat_booking_discount_threshold" integer DEFAULT 8 NOT NULL;
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "repeat_booking_discount_percent" integer DEFAULT 15 NOT NULL;
