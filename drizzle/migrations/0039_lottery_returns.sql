CREATE TABLE "lottery_returns" (
	"id" text PRIMARY KEY NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"expenses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"other_proceeds_pence" integer DEFAULT 0 NOT NULL,
	"purpose" text DEFAULT 'Upkeep and improvement of Loddiswell''s community facilities' NOT NULL,
	"figures" jsonb,
	"emailed_at" timestamp,
	"emailed_to" text,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "lottery_registration_number" text DEFAULT 'SL0269' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "lottery_promoter_name" text DEFAULT 'Zoë Crockford' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lottery_returns_period_idx" ON "lottery_returns" USING btree ("period_start");