CREATE TABLE "booking_discount_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discount_percent" integer NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"max_redemptions" integer,
	"max_redemptions_per_customer" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_code_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_percent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_discount_codes" ADD CONSTRAINT "booking_discount_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_discount_codes_code_idx" ON "booking_discount_codes" USING btree ("code");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_discount_code_id_booking_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."booking_discount_codes"("id") ON DELETE set null ON UPDATE no action;