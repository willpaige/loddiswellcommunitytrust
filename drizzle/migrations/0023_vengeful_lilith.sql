CREATE TABLE "lottery_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"source" text DEFAULT 'stripe' NOT NULL,
	"reference" text NOT NULL,
	"amount" integer NOT NULL,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lottery_payments" ADD CONSTRAINT "lottery_payments_ticket_id_lottery_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."lottery_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lottery_payments_reference_idx" ON "lottery_payments" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "lottery_payments_ticket_idx" ON "lottery_payments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "lottery_payments_paid_at_idx" ON "lottery_payments" USING btree ("paid_at");--> statement-breakpoint
-- Backfill the first payment for every existing ticket so historic lottery
-- income is still visible in reports. Renewals taken before this table existed
-- were never recorded anywhere and cannot be recovered from the ticket row.
INSERT INTO "lottery_payments" ("id", "ticket_id", "source", "reference", "amount", "paid_at", "created_at")
SELECT
  'bf_' || "id",
  "id",
  "source",
  'backfill:' || "id",
  "amount",
  "purchase_date",
  now()
FROM "lottery_tickets"
WHERE "amount" > 0 AND "status" <> 'refunded'
ON CONFLICT ("reference") DO NOTHING;
