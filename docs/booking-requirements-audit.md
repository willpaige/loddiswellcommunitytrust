# Booking requirements audit — 7 October 2026

This records the original investigation. See [the implemented flow](booking-requirements-flow.md) for the subsequent fixes, current tests and rollout procedure.

## Live evidence

- Ten confirmed bookings have an assigned requirements set. Four have answered every question and supplied every conditionally required document; six have no answers.
- No confirmed booking is missing a requirements set where its current offering has one.
- Four customer requirement reminders were logged as sent. Postmark records a `Delivered` event for each (5 September, 20 September, 27 September and 5 October). This proves receiving-server acceptance, not that someone read the email.
- Two customer requirement reminders failed, on 23 and 30 September, both for the Trust's LPFVHT booking. Postmark rejected its old `lpvht@gmail.com` recipient as inactive/suppressed.
- Four manager requirement reminders were sent. The failed customer sends throw before the manager send, so the manager notification is skipped for those failures.
- The live customer/manager requirement templates and both booking confirmation templates are enabled.
- Three unanswered bookings were created the day before their first session and have no requirement-reminder history.
- One unanswered booking received both scheduled reminders; another received its seven-day reminder. Receipt alone does not guarantee completion.

## Journey findings

1. **Signed-out reminder links return 404.** The page catches the action's `Unauthorized` exception and calls `notFound()`. There is no account middleware redirect. Fixed locally by redirecting to sign-in before loading the booking and preserving the exact form URL.
2. **No initial request.** Neither live confirmation template mentions the questionnaire or links to it. The booking-success page links to the booking list but does not prompt for requirements. Customers can discover the form in their account.
3. **Late bookings and retries are missed.** The daily requirements cron only selects the exact calendar dates 14 and 7 days ahead. Bookings confirmed after those runs, short-notice bookings, missed cron runs and failed sends are not caught up on subsequent days. Existing successful-send deduplication does not provide retry scheduling.
4. **One email failure stops the batch.** The customer send throws before the manager send and exits the whole cron, potentially preventing later candidates from being processed. The observed failures establish the first two effects; the audit does not establish that other candidates were present on those runs.
5. **Recurring bookings use the first start date.** Chasing and the UI lock both use `bookings.startDate`, not the next future occurrence. An unanswered recurring booking first started on 9 September and still has an upcoming occurrence on 14 October. Its form is now locked.
6. **Upload size mismatch.** The UI/action allow 10 MB, but `next.config.ts` does not override the installed Next.js server-action default of 1 MB. Large uploads can fail before reaching the action's own validation. Upload and save handlers also lack user-facing exception feedback.
7. **Requirements are not an access gate.** Bookings confirm and access information is sent regardless of form completion. This is current behaviour, not a failed completion check.

## Email correction applied

At the user's request, the LPFVHT booking's customer email was changed to `hello@loddiswellcommunitytrust.org` and linked to the existing account for that address. The update returned the expected booking and account IDs. No email was sent or replayed.

The database's public contact address already uses `hello@loddiswellcommunitytrust.org`. Booking manager email is unset and therefore falls back to that address; the latest manager notification uses it. Local `EMAIL_FROM` and `CONTACT_EMAIL` also use it. No stored page content contains the old Gmail address.

Fallback sender addresses in authentication, transactional mail, contact mail and `.env.example` were updated locally to `hello@loddiswellcommunitytrust.org`. Historical delivery logs and the old customer account were retained; accounts were not merged. Production environment variables were not separately inspected.

## Validation and limits

- TypeScript check: `npx tsc --noEmit`.
- `node --test scripts/test-booking-requirements.cjs`: real actions and requirement-status logic, with isolated database/auth/blob substitutes. Covers empty form, saved answers, conditional document upload, completed status, batch status, answer changes, blank text, ownership and signed-out access.
- Local HTTP check: opening `/account/bookings/test-booking/requirements` without a session returns HTTP 307 to `/account/login?callbackUrl=%2Faccount%2Fbookings%2Ftest-booking%2Frequirements`.
- Live database and Postmark checks were read-only except for the explicitly requested Trust booking email correction.
- This is not a full browser end-to-end pass: no real sign-in email was sent, no live booking/payment was created, and no live document was uploaded. The isolated tests do not exercise framework upload limits or real Blob availability.
- Local application changes have not been deployed.

## Remaining remediation

Add an initial form request, catch-up reminder scheduling and independent per-recipient failure handling; handle active recurring bookings; align upload limits and show actionable save/upload errors. These changes remain outstanding. Whether incomplete forms should block access information is a separate product decision.
