CREATE TABLE IF NOT EXISTS "event_series" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '{}' NOT NULL,
  "location" text,
  "image_url" text,
  "external_url" text,
  "published" boolean DEFAULT true,
  "all_day" boolean DEFAULT false,
  "recurrence" text NOT NULL,
  "week_of_month" integer NOT NULL,
  "weekday" integer NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "start_month" timestamp NOT NULL,
  "months_ahead" integer DEFAULT 18 NOT NULL,
  "exclude_months" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "block_facility_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text
);

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "series_id" text;

DO $$ BEGIN
 ALTER TABLE "event_series" ADD CONSTRAINT "event_series_block_facility_id_facilities_id_fk" FOREIGN KEY ("block_facility_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "event_series" ADD CONSTRAINT "event_series_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

