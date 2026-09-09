-- Migration 0022 created a payment row for every booking already paid for, but
-- left `created_at` on its default, so each of those rows is dated the moment
-- the migration ran rather than the day the money was taken. Reporting reads
-- that column as the payment date, which moved a month of booking income into
-- whichever day the deploy happened.
--
-- The backfilled rows are the ones 0022 gave an md5 id; everything the webhook
-- has written since uses a cuid2. For a one-off card booking, checkout is
-- completed a minute or two after the booking row is created -- the two payments
-- recorded live bear that out -- so the booking's own timestamp is the closest
-- honest date available without going back to Stripe.
UPDATE "booking_payments" bp
SET "created_at" = b."created_at"
FROM "bookings" b
WHERE b."id" = bp."booking_id"
  AND bp."id" ~ '^[0-9a-f]{32}$'
  AND bp."created_at" > b."created_at";
