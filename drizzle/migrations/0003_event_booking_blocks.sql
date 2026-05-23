ALTER TABLE "booking_blocks" ADD COLUMN IF NOT EXISTS "event_id" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_blocks" ADD CONSTRAINT "booking_blocks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
