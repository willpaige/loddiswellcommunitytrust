-- 0020 seeded unit_amount from the current price list, which is not what older
-- bookings were sold at: k5p9qe74z4mhxg563j9sos65 paid £7.50/hr for four hours
-- while the list now reads £15. Derive the rate from the money actually taken
-- instead, so rescheduling reprices against the agreed rate. Bookings genuinely
-- sold at £0 keep a 0 rate and stay free.
UPDATE "bookings"
SET "unit_amount" = ROUND(
  "amount"::numeric
  / GREATEST(1, EXTRACT(EPOCH FROM ("end_date" - "start_date")) / 3600)
  / CASE WHEN "recurrence" <> 'none' AND "payment_type" <> 'subscription'
      THEN GREATEST(1, "repeat_count") ELSE 1 END
)
WHERE "schedule_type" = 'regular' AND "end_date" > "start_date";
