ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "repeat_count" integer DEFAULT 1 NOT NULL;
