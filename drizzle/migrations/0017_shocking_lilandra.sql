CREATE TABLE "booking_block_series" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"title" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"recurrence" text NOT NULL,
	"indefinite" boolean DEFAULT false NOT NULL,
	"repeat_count" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "booking_blocks" ADD COLUMN "series_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "indefinite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_block_series" ADD CONSTRAINT "booking_block_series_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_block_series" ADD CONSTRAINT "booking_block_series_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_blocks" ADD CONSTRAINT "booking_blocks_series_id_booking_block_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."booking_block_series"("id") ON DELETE cascade ON UPDATE no action;