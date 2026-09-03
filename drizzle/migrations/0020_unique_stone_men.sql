ALTER TABLE "bookings" ADD COLUMN "paid_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "unit_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pricing_percent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "change_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- A confirmed booking is settled under the old model, so its paid amount is its
-- amount. Anything not confirmed has taken no money.
UPDATE "bookings" SET "paid_amount" = "amount" WHERE "status" = 'confirmed';--> statement-breakpoint
-- Best-effort rate history for bookings taken before the rate was recorded.
-- Where no price row survives, unit_amount stays 0 and repricing falls back to
-- the current price list.
UPDATE "bookings" b
SET "unit_amount" = p."amount"
FROM "booking_prices" p
WHERE p."offering_id" = b."offering_id"
  AND p."customer_group" = b."customer_group"
  AND b."unit_amount" = 0;--> statement-breakpoint
UPDATE "bookings" SET "pricing_percent" = "discount_percent" WHERE "discount_percent" > 0;
