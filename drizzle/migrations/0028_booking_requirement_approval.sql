ALTER TABLE bookings ADD COLUMN requirement_approved_at timestamp;
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN requirement_approved_by text;
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN requirement_approval_note text;
