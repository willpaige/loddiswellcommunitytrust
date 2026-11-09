# Monthly invoice coverage

The initial invoice may start at the first booking date instead of the first of the month, and may include the following month. The monthly process must check whether the actual sessions are already invoiced before it creates an invoice or changes their allocations. Calendar-boundary equality is insufficient and caused duplicate October invoices for a booking starting on 5 October 2026.

`findInvoiceCoveringSessions` checks non-void invoice coverage for each session, including legacy British summer time period boundaries. Fully covered periods are skipped. Partial overlaps and overlapping unfinished drafts fail with a review message rather than charging any session twice. An exact existing draft can resume. Voided invoices do not prevent replacement invoices, and subsequent uncovered months can be billed normally.

This guard prevents repeat billing by the monthly cycle; it is not a distributed lock for simultaneous invoice creation. Existing overlapping invoices need reconciliation separately. A paid duplicate must be reconciled with the actual bank receipt and Stripe accounting before adjusting the payment ledger; do not record another payment or invent a refund.

Validation: `tests/booking-invoices.test.ts` exercises the actual monthly cycle with an isolated database and forbids Stripe calls for already-paid sessions. It also checks multi-month initial coverage, partial overlaps, drafts, voids and later months.
