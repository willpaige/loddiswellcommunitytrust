import type { EmailExtras } from "@/lib/email/layout";
import type { EmailTemplateKey } from "@/lib/email/defaults";

// Per-template dressing that the plain-text bodies can't carry: the eyebrow and
// headline at the top, the inbox preview line, what a link's button says, and
// a button for a link the body leaves out (e.g. the booking confirmation
// mentions "your account" but never links to it).

type Vars = Record<string, string | number | null | undefined>;
type Decor = {
  eyebrow?: string;
  headline?: (v: Vars) => string;
  preheader?: (v: Vars) => string;
  /** Labels for buttons made from URL variables. */
  buttons?: Record<string, string>;
  /** Variable whose URL becomes the main button when the body doesn't use it. */
  cta?: string;
  /** Variable holding comma-separated numbers to show as chips. */
  chips?: string;
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const facility = (v: Vars) => s(v.facilityName) || "Your booking";

const DECOR: Partial<Record<EmailTemplateKey, Decor>> = {
  booking_confirmation: { eyebrow: "Booking confirmed", headline: facility, preheader: (v) => `${s(v.facilityName)} · ${s(v.schedule)}`, cta: "bookingUrl" },
  booking_manager_notification: { eyebrow: "New booking", headline: (v) => `${s(v.customerName)}, ${s(v.facilityName)}`, preheader: (v) => s(v.schedule) },
  manual_booking_confirmation: { eyebrow: "Booking added", headline: facility, preheader: (v) => `${s(v.facilityName)} · ${s(v.schedule)}` },
  manual_booking_payment_link: { eyebrow: "Payment needed", headline: facility, preheader: (v) => `${s(v.amount)} to confirm your booking` },
  booking_changed: { eyebrow: "Booking changed", headline: facility, preheader: (v) => `Now ${s(v.schedule)}`, cta: "bookingUrl" },
  booking_change_payment_link: { eyebrow: "Balance to pay", headline: facility, preheader: (v) => `${s(v.balance)} left to pay` },
  booking_cancellation: { eyebrow: "Booking cancelled", headline: facility },
  booking_payment_failed: { eyebrow: "Payment problem", headline: facility, cta: "bookingUrl" },
  booking_payment_reminder: { eyebrow: "Payment needed", headline: facility, preheader: (v) => `Held for you until ${s(v.holdUntil)}`, buttons: { paymentUrl: "Pay and confirm" } },
  booking_payment_last_call: { eyebrow: "Last chance", headline: facility, preheader: (v) => `Pay by ${s(v.holdUntil)} to keep your booking`, buttons: { paymentUrl: "Pay and confirm" } },
  booking_payment_released: { eyebrow: "Booking released", headline: facility, buttons: { bookingPageUrl: "Book again" } },
  booking_payment_released_manager: { eyebrow: "Unpaid booking released", headline: (v) => `${s(v.customerName)}, ${s(v.facilityName)}`, preheader: (v) => s(v.schedule) },
  booking_invoice_issued: { eyebrow: "Invoice", headline: (v) => `${s(v.facilityName)}, ${s(v.period)}`, preheader: (v) => `${s(v.amount)} due ${s(v.dueDate)}` },
  booking_invoice_reminder: { eyebrow: "Invoice reminder", headline: (v) => `${s(v.facilityName)}, ${s(v.period)}`, preheader: (v) => `${s(v.amount)} ${s(v.when)}` },
  booking_invoice_overdue: { eyebrow: "Invoice overdue", headline: (v) => `${s(v.facilityName)}, ${s(v.period)}`, preheader: (v) => `${s(v.amount)} was due ${s(v.dueDate)}` },
  booking_invoice_overdue_manager: { eyebrow: "Overdue invoice", headline: (v) => `${s(v.customerName)}, ${s(v.facilityName)}` },
  booking_invoice_released: { eyebrow: "Sessions released", headline: facility },
  booking_invoice_released_manager: { eyebrow: "Sessions released", headline: (v) => `${s(v.customerName)}, ${s(v.facilityName)}` },
  booking_reminder: { eyebrow: "See you tomorrow", headline: facility, preheader: (v) => s(v.startDate) },
  booking_extension_conflict: { eyebrow: "Action needed", headline: () => "Recurring sessions not scheduled" },
  booking_requirements_customer: { eyebrow: "Action needed", headline: facility, preheader: (v) => `Information needed for ${s(v.startDate)}` },
  booking_requirements_manager: { eyebrow: "Outstanding requirements", headline: (v) => `${s(v.facilityName)}, ${s(v.startDate)}` },
  lottery_welcome: {
    eyebrow: "Welcome to the lottery",
    headline: () => "Thank you for joining",
    preheader: (v) => `Your ticket numbers: ${s(v.ticketNumbers)}`,
    cta: "manageUrl",
    chips: "ticketNumbers",
  },
  lottery_payment_failed: { eyebrow: "Payment problem", headline: () => "Your lottery subscription", cta: "manageUrl" },
  lottery_draw_results: { eyebrow: "Community Lottery", headline: (v) => `${s(v.drawDate)} results`, preheader: () => "This month's winners" },
  lottery_manage_link: { eyebrow: "Community Lottery", headline: () => "Manage your subscription" },
  raffle_tickets: {
    eyebrow: "You're in the draw",
    headline: (v) => `Your ${s(v.raffleTitle)} tickets`,
    preheader: (v) => `Tickets ${s(v.ticketNumbers)} · Drawn ${s(v.drawDate)}`,
    buttons: { raffleUrl: "View the raffle" },
    chips: "ticketNumbers",
  },
  raffle_winner: { eyebrow: "Congratulations", headline: (v) => `You've won ${s(v.prizeName)}`, preheader: (v) => `Ticket ${s(v.ticketNumber)} was drawn` },
  raffle_results: { eyebrow: "Raffle results", headline: (v) => s(v.raffleTitle), preheader: (v) => `We raised ${s(v.totalRaised)}. Here are the winners.` },
  raffle_draw_manager: { eyebrow: "Raffle drawn", headline: (v) => s(v.raffleTitle) },
  raffle_on_sale: { buttons: { raffleUrl: "Buy tickets" } },
  raffle_week_reminder: { buttons: { raffleUrl: "Buy tickets" } },
  raffle_last_call: { buttons: { raffleUrl: "Buy tickets" } },
  raffle_draw_reminder: { eyebrow: "Draw day", headline: (v) => `The ${s(v.raffleTitle)} draw is today`, preheader: (v) => `Your tickets: ${s(v.yourTickets)}`, buttons: { raffleUrl: "View the raffle" } },
};

const BUTTONS: Record<string, string> = {
  bookingUrl: "Manage your booking",
  paymentUrl: "Pay securely",
  invoiceUrl: "View and pay invoice",
  manageUrl: "Manage your tickets",
  resultsUrl: "See the full results",
  adminUrl: "Open in admin",
  raffleUrl: "View the raffle",
};

export function buttonLabelFor(key: EmailTemplateKey) {
  const own = DECOR[key]?.buttons ?? {};
  return (variable: string) => own[variable] ?? BUTTONS[variable];
}

/** Template dressing, with anything the sender passed taking precedence. */
export function decorate(key: EmailTemplateKey, variables: Vars, body: string, extras: EmailExtras = {}): EmailExtras {
  const d = DECOR[key] ?? {};
  const out: EmailExtras = { ...extras };
  out.eyebrow ??= d.eyebrow;
  out.headline ??= d.headline?.(variables);
  out.preheader ??= d.preheader?.(variables);
  if (!out.cta && d.cta) {
    const url = s(variables[d.cta]).trim();
    if (url && !body.includes(url)) out.cta = { label: buttonLabelFor(key)(d.cta) ?? "Open", url };
  }
  if (!out.chips && d.chips) {
    const parts = s(variables[d.chips]).split(",").map((p) => p.trim()).filter(Boolean);
    // A long list stays as text; a wall of chips is harder to read.
    if (parts.length > 0 && parts.length <= 12) out.chips = parts;
  }
  return out;
}
