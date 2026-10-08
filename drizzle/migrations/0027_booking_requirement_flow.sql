CREATE TABLE "booking_requirement_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"recipient" text NOT NULL,
	"kind" text NOT NULL,
	"stage" text NOT NULL,
	"cycle" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"last_attempt_at" timestamp DEFAULT now() NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"provider_message_id" text,
	"delivery_status" text,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "requirement_completed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "requirement_review_after" timestamp;
--> statement-breakpoint
ALTER TABLE "booking_requirement_messages" ADD CONSTRAINT "booking_requirement_messages_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "booking_requirement_messages_booking_idx" ON "booking_requirement_messages" USING btree ("booking_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_requirement_documents_url_idx" ON "booking_requirement_documents" USING btree ("file_url");
--> statement-breakpoint
-- Preserve administrator wording while adding the missing action/deadline links.
UPDATE email_templates SET body = body || E'\n\n{{requirementsNotice}}',
  variables = CASE WHEN variables ? 'requirementsNotice' THEN variables ELSE variables || '["requirementsNotice"]'::jsonb END,
  updated_at = now()
WHERE key IN ('booking_confirmation', 'manual_booking_confirmation', 'booking_changed', 'booking_reminder')
  AND position('{{requirementsNotice}}' in body) = 0;
--> statement-breakpoint
UPDATE email_templates SET body = body || E'\n\n{{deadline}}\nSign in using the email address on your booking. Answers save as you go.',
  variables = CASE WHEN variables ? 'deadline' THEN variables ELSE variables || '["deadline"]'::jsonb END,
  updated_at = now()
WHERE key = 'booking_requirements_customer' AND position('{{deadline}}' in body) = 0;
--> statement-breakpoint
UPDATE email_templates SET body = body || E'\n\n{{reason}}\nCustomer email: {{customerEmail}}\nReview booking: {{adminUrl}}',
  variables = variables || '["reason", "customerEmail", "adminUrl"]'::jsonb,
  updated_at = now()
WHERE key = 'booking_requirements_manager' AND position('{{adminUrl}}' in body) = 0;
