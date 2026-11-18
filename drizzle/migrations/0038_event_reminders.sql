ALTER TABLE "events" ADD COLUMN "reminder_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reminder_claimed_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reminder_sent_at" timestamp;