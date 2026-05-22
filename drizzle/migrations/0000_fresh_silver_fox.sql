ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'customer';
--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "bookable_start_time" text DEFAULT '08:00' NOT NULL;
--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "bookable_end_time" text DEFAULT '23:00' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_offerings" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL REFERENCES "public"."facilities"("id") ON DELETE cascade,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"start_time" text,
	"end_time" text,
	"allowed_days" jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"offering_id" text NOT NULL REFERENCES "public"."booking_offerings"("id") ON DELETE cascade,
	"customer_group" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text REFERENCES "public"."users"("id") ON DELETE set null,
	"facility_id" text NOT NULL REFERENCES "public"."facilities"("id") ON DELETE restrict,
	"offering_id" text REFERENCES "public"."booking_offerings"("id") ON DELETE set null,
	"customer_group" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text,
	"notes" text,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"payment_type" text DEFAULT 'one_off' NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"recurrence" text DEFAULT 'none' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "bookings_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_occurrences" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL REFERENCES "public"."bookings"("id") ON DELETE cascade,
	"facility_id" text NOT NULL REFERENCES "public"."facilities"("id") ON DELETE restrict,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL REFERENCES "public"."facilities"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text REFERENCES "public"."users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_blocks_facility_start_idx" ON "booking_blocks" USING btree ("facility_id","start_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_occurrences_facility_start_idx" ON "booking_occurrences" USING btree ("facility_id","start_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_occurrences_booking_idx" ON "booking_occurrences" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_facility_start_idx" ON "bookings" USING btree ("facility_id","start_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_user_idx" ON "bookings" USING btree ("user_id");
