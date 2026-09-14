-- Regular hirers who want a slot held indefinitely but would rather not keep a
-- card on file are invoiced month by month, in advance, for the sessions that
-- month actually holds. Each invoice is its own row: the booking keeps the
-- slot, the ledger says what has been billed and paid.
CREATE TABLE IF NOT EXISTS "booking_invoices" (
  "id" text PRIMARY KEY NOT NULL,
  "booking_id" text NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "stripe_invoice_id" text,
  "period_start" timestamp NOT NULL,
  "period_end" timestamp NOT NULL,
  "session_count" integer NOT NULL DEFAULT 0,
  "amount" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'draft',
  "due_date" timestamp NOT NULL,
  "hosted_url" text,
  "pdf_url" text,
  "paid_at" timestamp,
  "paid_out_of_band" boolean NOT NULL DEFAULT false,
  "revision" integer NOT NULL DEFAULT 0,
  "released_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_invoices_stripe_idx" ON "booking_invoices" ("stripe_invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_invoices_booking_idx" ON "booking_invoices" ("booking_id");
--> statement-breakpoint
-- One live invoice per booking per period; a voided one can be reissued.
CREATE UNIQUE INDEX IF NOT EXISTS "booking_invoices_period_live_idx"
  ON "booking_invoices" ("booking_id", "period_start") WHERE "status" <> 'void';
--> statement-breakpoint
-- A bank transfer against an invoice has no payment intent behind it, and the
-- current Stripe API no longer exposes one on the invoice at all, so payments
-- can be keyed on the invoice instead.
ALTER TABLE "booking_payments" ALTER COLUMN "stripe_payment_intent_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD COLUMN IF NOT EXISTS "stripe_invoice_id" text;
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD COLUMN IF NOT EXISTS "paid_out_of_band" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_payments_invoice_idx" ON "booking_payments" ("stripe_invoice_id");
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "monthly_invoice_lead_days" integer NOT NULL DEFAULT 7;
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "monthly_invoice_grace_days" integer NOT NULL DEFAULT 7;
