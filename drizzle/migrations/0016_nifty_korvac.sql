ALTER TABLE "booking_occurrences" ADD COLUMN "allocated_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_occurrences" ADD COLUMN "promotion_event_id" text;--> statement-breakpoint
ALTER TABLE "booking_occurrences" ADD COLUMN "refund_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_occurrences" ADD COLUMN "refund_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_occurrences" ADD COLUMN "refunded_at" timestamp;--> statement-breakpoint
ALTER TABLE "booking_occurrences" ADD COLUMN "refunded_by" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "schedule_type" text DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_occurrences" ADD CONSTRAINT "booking_occurrences_promotion_event_id_events_id_fk" FOREIGN KEY ("promotion_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_occurrences" ADD CONSTRAINT "booking_occurrences_refunded_by_users_id_fk" FOREIGN KEY ("refunded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;