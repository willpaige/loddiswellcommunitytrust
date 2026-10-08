# Booking information flow

## Customer journey

Confirmed online and manual bookings send an immediate requirement request independently of confirmation and manager emails. Confirmations and booking-change/access reminders include a direct form link and deadline. The success page and account booking list show the outstanding task.

Customers sign in with the booking email and return to the same form. Radio answers save immediately; text saves on blur, with an explicit Save answers retry. Saves are serialized and partial updates do not erase other answers. The completion receipt appears only after all answers and conditional documents are persisted.

Documents upload directly to Vercel Blob using a short-lived token authorized for the customer's booking and question. The server verifies the stored document's path, size and MIME type before recording it. PDF, PNG and JPG up to 10 MB are supported without sending the file through a server action. Cancelled bookings and bookings without future sessions cannot be edited. Payment and access instructions are not blocked by form completion.

## Reminders and recurring bookings

The hourly cron runs at minute 15. It checks the next upcoming session, including ongoing series, and chooses one applicable stage: initial, 14 days, 7 days or 48 hours. An initial/catch-up request inside a reminder window counts as that window's request. A 24-hour cooldown prevents clustered automatic requests. Completed bookings are skipped.

The deadline is 48 hours before the next session; inside that window the customer is asked to complete immediately. Managers are alerted independently for short-notice/overdue information and failed customer sends. Accepted messages are checked for delivery/bounce on subsequent cron runs; detected bounces trigger manager alerts.

Persistent message leases prevent concurrent sends of the same request. Failed sends retry after 1, 2, 4, 8, 16 and then 24 hours. Expired leases recover interrupted jobs, and the email log protects a retry when an earlier send was recorded successfully. As with external email APIs, a crash between provider acceptance and database logging can still leave an ambiguous send outcome.

Completed answers apply to every unchanged session in a series. Changing a question's relevant requirements, organiser email/organisation, or booking type requires fresh information. Earlier documents are retained, but do not satisfy requirements newer than those documents. Changing an offering's default requirements does not overwrite existing booking snapshots.

## Manager view and monitoring

`/admin/bookings/requirements/outstanding` lists outstanding confirmed bookings by next session. It shows not started/questions incomplete/documents missing, the outstanding items, last send attempt and provider acceptance/delivery/bounce status. Managers can open the booking or manually resend. Manual sends require an admin/editor session and are audited.

The page also reports upcoming ready/outstanding counts, recorded completions before the first session and manual interventions in the last 30 days. Historical forms without recorded completion timestamps are excluded from completion-timing figures. This dashboard does not claim that delivered email was read.

## Validation

- `npm test`: isolated PostgreSQL-compatible database tests run the actual new migration, actions, reminder logic and email rendering; authentication, Blob and Postmark are controlled substitutes.
- `npm run test:browser`: Chromium checks the actual React form against isolated services, including autosave, a 9 MB upload, reload, document removal and save/upload failure recovery.
- `npm run build`: production compilation and TypeScript.
- Browser tests do not create real customer bookings, charge payments, deliver emails or upload files to production storage.

## Deployment

1. Verify the configured production database and back up editable templates if needed.
2. Apply `0027_booking_requirement_flow` through the existing Drizzle migration runner. It adds completion/review timestamps, the message lease table and unique document URLs, and appends missing placeholders to existing templates without replacing their wording.
3. Set `CRON_SECRET` in production. The requirement cron rejects missing/incorrect authorization. Vercel supplies the bearer header on scheduled calls: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
4. Deploy, verify the signed-out form redirect and unauthorized cron response, then preview catch-up candidates with `scripts/run-requirement-reminders.ts`.
5. Run the authorized cron once for catch-up. Re-run to verify no duplicates, and check new message records/Postmark outcomes.

Rollback can restore the earlier application deployment while retaining the additive schema and message history. Do not drop customer answers or documents. The old deployment will ignore new template placeholders it does not provide.
