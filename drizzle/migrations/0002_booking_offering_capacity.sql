ALTER TABLE "booking_offerings" ADD COLUMN IF NOT EXISTS "capacity" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE "booking_offerings"
SET "capacity" = 2
WHERE "id" IN (
	SELECT bo."id"
	FROM "booking_offerings" bo
	INNER JOIN "facilities" f ON f."id" = bo."facility_id"
	WHERE f."slug" = 'tennis-courts'
);
