-- The lottery results email gets a proper raffles section ({{raffles}}: every
-- running raffle plus recent raffle results) in place of the one-line promo.
-- A trustee's own wording is kept; only the placeholder is swapped, or added
-- at the end if they removed it.
UPDATE "email_templates"
SET "body" = CASE
      WHEN "body" LIKE '%{{rafflePromo}}%' THEN replace("body", '{{rafflePromo}}', '{{raffles}}')
      ELSE "body" || E'\n\n{{raffles}}'
    END,
    "updated_at" = now()
WHERE "key" = 'lottery_draw_results'
  AND "body" NOT LIKE '%{{raffles}}%';
