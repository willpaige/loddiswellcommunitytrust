-- Access details (gate PINs, key-locker codes) only went out in the reminder
-- email, which the cron sends 23-25 hours before a booking starts. Anyone who
-- booked inside that window never received them. Add them to both confirmation
-- emails so every customer gets them as soon as the booking is confirmed.
--
-- Templates are editable in the admin, so the defaults in code only seed rows
-- that don't exist yet. Insert the block ahead of each template's closing line,
-- falling back to appending it, and skip any template that already uses it.
UPDATE "email_templates"
SET
  "body" = CASE
    WHEN "key" = 'booking_confirmation'
      AND position(E'\n\nYou can manage your booking from your account.' in "body") > 0
      THEN replace("body", E'\n\nYou can manage your booking from your account.',
        E'\n\nAccess information:\n{{accessInstructions}}\n\nYou can manage your booking from your account.')
    WHEN "key" = 'manual_booking_confirmation'
      AND position(E'\n\nPlease contact us if anything looks wrong.' in "body") > 0
      THEN replace("body", E'\n\nPlease contact us if anything looks wrong.',
        E'\n\nAccess information:\n{{accessInstructions}}\n\nPlease contact us if anything looks wrong.')
    ELSE "body" || E'\n\nAccess information:\n{{accessInstructions}}'
  END,
  "variables" = CASE
    WHEN "variables" ? 'accessInstructions' THEN "variables"
    ELSE "variables" || '["accessInstructions"]'::jsonb
  END,
  "updated_at" = now()
WHERE "key" IN ('booking_confirmation', 'manual_booking_confirmation')
  AND position('{{accessInstructions}}' in "body") = 0;
