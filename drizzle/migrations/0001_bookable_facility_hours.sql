ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "bookable_start_time" text DEFAULT '08:00' NOT NULL;
--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "bookable_end_time" text DEFAULT '23:00' NOT NULL;
