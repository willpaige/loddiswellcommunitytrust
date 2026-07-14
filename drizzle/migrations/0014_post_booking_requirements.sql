CREATE TABLE IF NOT EXISTS "requirement_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "requirement_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"set_id" text NOT NULL,
	"label" text NOT NULL,
	"type" text DEFAULT 'yes_no' NOT NULL,
	"requires_document_on_yes" boolean DEFAULT false NOT NULL,
	"document_label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_requirement_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"question_id" text NOT NULL,
	"question_label" text NOT NULL,
	"answer_bool" boolean,
	"answer_text" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_requirement_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"question_id" text NOT NULL,
	"document_label" text,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" text
);
--> statement-breakpoint
ALTER TABLE "booking_offerings" ADD COLUMN IF NOT EXISTS "requirement_set_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "requirement_set_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "requirement_questions" ADD CONSTRAINT "requirement_questions_set_id_requirement_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."requirement_sets"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "booking_requirement_responses" ADD CONSTRAINT "booking_requirement_responses_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "booking_requirement_responses" ADD CONSTRAINT "booking_requirement_responses_question_id_requirement_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."requirement_questions"("id") ON DELETE restrict ON UPDATE no action;
 ALTER TABLE "booking_requirement_documents" ADD CONSTRAINT "booking_requirement_documents_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "booking_requirement_documents" ADD CONSTRAINT "booking_requirement_documents_question_id_requirement_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."requirement_questions"("id") ON DELETE restrict ON UPDATE no action;
 ALTER TABLE "booking_requirement_documents" ADD CONSTRAINT "booking_requirement_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
 ALTER TABLE "booking_offerings" ADD CONSTRAINT "booking_offerings_requirement_set_id_requirement_sets_id_fk" FOREIGN KEY ("requirement_set_id") REFERENCES "public"."requirement_sets"("id") ON DELETE set null ON UPDATE no action;
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_requirement_set_id_requirement_sets_id_fk" FOREIGN KEY ("requirement_set_id") REFERENCES "public"."requirement_sets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requirement_questions_set_idx" ON "requirement_questions" USING btree ("set_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_requirement_responses_booking_question_idx" ON "booking_requirement_responses" USING btree ("booking_id","question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_requirement_documents_booking_idx" ON "booking_requirement_documents" USING btree ("booking_id");
