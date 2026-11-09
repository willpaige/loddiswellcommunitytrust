-- Cross-sell the current raffle in the lottery and booking emails, as the
-- lottery is cross-sold elsewhere. {{rafflePromo}} renders as one line about
-- the raffle on sale, or nothing at all when there isn't one.
--
-- Only templates that don't already mention it are changed, so this is safe
-- to run on a body a trustee has edited; their wording is kept and the line
-- is added at the end.
UPDATE "email_templates"
SET "body" = "body" || E'\n\n{{rafflePromo}}',
    "updated_at" = now()
WHERE "key" IN ('lottery_welcome', 'lottery_draw_results', 'booking_confirmation')
  AND "body" NOT LIKE '%{{rafflePromo}}%';
--> statement-breakpoint
UPDATE "email_templates"
SET "variables" = "variables" || '["rafflePromo"]'::jsonb
WHERE "key" IN ('lottery_welcome', 'lottery_draw_results', 'booking_confirmation')
  AND NOT ("variables" ? 'rafflePromo');
