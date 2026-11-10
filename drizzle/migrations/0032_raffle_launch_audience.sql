CREATE TABLE "raffle_email_opt_outs" (
	"email" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- The on-sale email now goes to everyone the Trust has an address for, so its
-- "why you're getting this" line changes. Only a body still on the old
-- default is updated; a trustee's own wording is left alone.
UPDATE "email_templates"
SET "body" = E'Hello,\n\nTickets for {{raffleTitle}} are on sale now at {{price}} each.\n\n{{tagline}}\n\nThe draw is on {{drawDate}}.\n\n{{raffleUrl}}\n\nYou''re getting this because you''ve supported Loddiswell Playing Field & Village Hall Trust, through the lottery, a booking, a raffle or our newsletter. Don''t want raffle news? Unsubscribe: {{unsubscribeUrl}}',
    "description" = 'Sent when a raffle''s tickets go on sale, to everyone the Trust has an email address for, except people who have unsubscribed.',
    "updated_at" = now()
WHERE "key" = 'raffle_on_sale'
  AND "body" = E'Hello,\n\nTickets for {{raffleTitle}} are on sale now at {{price}} each.\n\n{{tagline}}\n\nThe draw is on {{drawDate}}.\n\n{{raffleUrl}}\n\nYou''re getting this because you asked to hear about raffles or entered one before. Unsubscribe: {{unsubscribeUrl}}';
