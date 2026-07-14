ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "access_instructions" text;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "booking_manager_email" text;

CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "category" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_key_unique" ON "email_templates" ("key");

CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "template_key" text NOT NULL,
  "recipient" text NOT NULL,
  "related_entity_type" text,
  "related_entity_id" text,
  "status" text NOT NULL,
  "provider_message_id" text,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "email_logs_template_related_idx" ON "email_logs" ("template_key", "related_entity_type", "related_entity_id");

CREATE TABLE IF NOT EXISTS "lottery_ticket_numbers" (
  "id" text PRIMARY KEY NOT NULL,
  "ticket_id" text NOT NULL REFERENCES "lottery_tickets"("id") ON DELETE cascade,
  "ticket_number" integer NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "lottery_ticket_numbers_number_idx" ON "lottery_ticket_numbers" ("ticket_number");
CREATE INDEX IF NOT EXISTS "lottery_ticket_numbers_ticket_idx" ON "lottery_ticket_numbers" ("ticket_id");
