CREATE TABLE "booking_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"amount" integer NOT NULL,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payments_intent_idx" ON "booking_payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "booking_payments_booking_idx" ON "booking_payments" USING btree ("booking_id");--> statement-breakpoint
-- Record what is known of the payments already taken. A live booking's payment
-- intent holds what it has been paid; anything settled through a later top-up
-- is not recoverable from here and is reconciled against Stripe by hand.
INSERT INTO "booking_payments" ("id", "booking_id", "stripe_payment_intent_id", "amount", "refunded_amount")
SELECT md5(random()::text || "id"), "id", "stripe_payment_intent_id", "paid_amount", 0
FROM "bookings"
WHERE "stripe_payment_intent_id" IS NOT NULL
  AND "status" <> 'cancelled'
  AND "paid_amount" > 0;
