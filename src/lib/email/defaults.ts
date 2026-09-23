export type EmailTemplateKey =
  | "booking_confirmation"
  | "booking_manager_notification"
  | "manual_booking_confirmation"
  | "manual_booking_payment_link"
  | "booking_cancellation"
  | "booking_payment_failed"
  | "booking_reminder"
  | "booking_extension_conflict"
  | "booking_requirements_customer"
  | "booking_requirements_manager"
  | "lottery_welcome"
  | "lottery_payment_failed"
  | "lottery_draw_results"
  | "lottery_manage_link"
  | "booking_changed"
  | "booking_change_payment_link"
  | "booking_invoice_issued"
  | "booking_invoice_reminder"
  | "booking_invoice_overdue"
  | "booking_invoice_overdue_manager"
  | "booking_invoice_released"
  | "booking_invoice_released_manager";

export type EmailTemplateCategory = "bookings" | "lottery" | "system";

export type EmailTemplateDefault = {
  key: EmailTemplateKey;
  category: EmailTemplateCategory;
  name: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
};

export const emailTemplateDefaults: EmailTemplateDefault[] = [
  {
    key: "booking_confirmation",
    category: "bookings",
    name: "Booking confirmation",
    description: "Sent to a customer when an online booking is confirmed.",
    subject: "Your Loddiswell booking is confirmed",
    body: "Hi {{customerName}},\n\nYour booking for {{facilityName}} is confirmed.\n\nBooking: {{offeringName}}\nSchedule: {{schedule}}\nAmount paid: {{amount}}\n\nAccess information:\n{{accessInstructions}}\n\nYou can manage your booking from your account.",
    variables: ["customerName", "facilityName", "offeringName", "startDate", "endTime", "schedule", "amount", "accessInstructions", "bookingUrl"],
  },
  {
    key: "booking_manager_notification",
    category: "bookings",
    name: "Booking manager notification",
    description: "Sent to the booking manager when a customer booking is confirmed.",
    subject: "New booking: {{facilityName}} on {{startDate}}",
    body: "A new booking has been confirmed.\n\nCustomer: {{customerName}}\nEmail: {{customerEmail}}\nPhone: {{customerPhone}}\nVenue: {{facilityName}}\nBooking: {{offeringName}}\nSchedule: {{schedule}}\nAmount: {{amount}}\n\nNotes: {{notes}}",
    variables: ["customerName", "customerEmail", "customerPhone", "facilityName", "offeringName", "startDate", "endTime", "schedule", "amount", "notes"],
  },
  {
    key: "manual_booking_confirmation",
    category: "bookings",
    name: "Manual booking confirmation",
    description: "Sent to a customer when an admin creates a manual booking.",
    subject: "Your Loddiswell booking has been added",
    body: "Hi {{customerName}},\n\nYour booking for {{facilityName}} has been added by the Trust.\n\nBooking: {{offeringName}}\nSchedule: {{schedule}}\n\nAccess information:\n{{accessInstructions}}\n\nPlease contact us if anything looks wrong.",
    variables: ["customerName", "facilityName", "offeringName", "startDate", "endTime", "schedule", "accessInstructions"],
  },
  {
    key: "manual_booking_payment_link",
    category: "bookings",
    name: "Manual booking payment link",
    description: "Sent to a customer when an admin creates a booking that needs online payment.",
    subject: "Payment link for your Loddiswell booking",
    body: "Hi {{customerName}},\n\nWe have reserved your booking for {{facilityName}}.\n\nBooking: {{offeringName}}\nSchedule: {{schedule}}\nAmount due: {{amount}}\n\nPlease use this secure Stripe link to pay and confirm your booking:\n\n{{paymentUrl}}",
    variables: ["customerName", "facilityName", "offeringName", "startDate", "endTime", "schedule", "amount", "paymentUrl"],
  },
  {
    key: "booking_changed",
    category: "bookings",
    name: "Booking changed",
    description: "Sent to a customer when the date or time of their booking changes.",
    subject: "Your Loddiswell booking has been changed",
    body: "Hi {{customerName}},\n\nYour booking for {{facilityName}} has been changed.\n\nWas: {{previousSchedule}}\nNow: {{schedule}}\n\nPrice: {{amount}}\n{{settlementLine}}\n\nPlease contact us if anything looks wrong.",
    variables: ["customerName", "facilityName", "offeringName", "previousSchedule", "schedule", "amount", "settlementLine", "bookingUrl"],
  },
  {
    key: "booking_change_payment_link",
    category: "bookings",
    name: "Booking change payment link",
    description: "Sent when a change leaves more to pay, with a Stripe link for the difference.",
    subject: "Payment for your changed Loddiswell booking",
    body: "Hi {{customerName}},\n\nYour booking for {{facilityName}} is now {{schedule}}.\n\nThat leaves {{balance}} to pay on top of the {{paidAmount}} already received.\n\nPlease use this secure Stripe link to settle it:\n\n{{paymentUrl}}\n\nYour booking is held in the meantime.",
    variables: ["customerName", "facilityName", "offeringName", "schedule", "amount", "paidAmount", "balance", "paymentUrl"],
  },
  {
    key: "booking_cancellation",
    category: "bookings",
    name: "Booking cancellation",
    description: "Sent when a booking is cancelled.",
    subject: "Your Loddiswell booking has been cancelled",
    body: "Hi {{customerName}},\n\nYour booking for {{facilityName}} on {{startDate}} has been cancelled.\n\nEligible card payments have been refunded automatically.",
    variables: ["customerName", "facilityName", "startDate", "amount"],
  },
  {
    key: "booking_payment_failed",
    category: "bookings",
    name: "Booking payment failed",
    description: "Sent when a booking subscription payment fails.",
    subject: "Payment issue with your Loddiswell booking",
    body: "Hi {{customerName}},\n\nThere was a problem taking payment for your booking at {{facilityName}}.\n\nPlease use your account to review the booking or update payment details.",
    variables: ["customerName", "facilityName", "bookingUrl"],
  },
  {
    key: "booking_invoice_issued",
    category: "bookings",
    name: "Monthly booking invoice",
    description: "Sent when a monthly-invoiced booking's invoice for the coming period is issued.",
    subject: "Invoice for your {{facilityName}} sessions: {{period}}",
    body: "Hi {{customerName}},\n\nHere is your invoice for {{offeringName}} at {{facilityName}} covering {{period}}.\n\nSessions:\n{{sessions}}\n\nAmount: {{amount}}\nDue: {{dueDate}}\n\nPay by card or bank transfer here:\n{{invoiceUrl}}\n\nBank details are on the invoice. If it is not paid within seven days of the due date, the sessions it covers are released for others to book.",
    variables: ["customerName", "facilityName", "offeringName", "period", "sessions", "amount", "dueDate", "invoiceUrl", "bookingUrl"],
  },
  {
    key: "booking_invoice_reminder",
    category: "bookings",
    name: "Monthly invoice reminder",
    description: "Sent three days before a monthly invoice is due, on the due date, and three days after.",
    subject: "Reminder: {{facilityName}} invoice for {{period}} is {{when}}",
    body: "Hi {{customerName}},\n\nA reminder that your invoice for {{offeringName}} at {{facilityName}} covering {{period}} is {{when}}.\n\nAmount: {{amount}}\nDue: {{dueDate}}\n\nPay here:\n{{invoiceUrl}}\n\nIf you have already paid by bank transfer, thank you - please ignore this reminder.",
    variables: ["customerName", "facilityName", "offeringName", "period", "when", "amount", "dueDate", "invoiceUrl", "bookingUrl"],
  },
  {
    key: "booking_invoice_overdue",
    category: "bookings",
    name: "Monthly invoice overdue",
    description: "Sent to the customer the day after a monthly invoice falls overdue.",
    subject: "Overdue: {{facilityName}} invoice for {{period}}",
    body: "Hi {{customerName}},\n\nYour invoice for {{offeringName}} at {{facilityName}} covering {{period}} was due on {{dueDate}} and has not been paid.\n\nAmount: {{amount}}\n\nPay here:\n{{invoiceUrl}}\n\nIf it is still unpaid on {{releaseDate}}, the sessions it covers will be released and your regular slot will end. If you have paid by bank transfer in the last day or two, please ignore this message.",
    variables: ["customerName", "facilityName", "offeringName", "period", "amount", "dueDate", "releaseDate", "invoiceUrl", "bookingUrl"],
  },
  {
    key: "booking_invoice_overdue_manager",
    category: "bookings",
    name: "Monthly invoice overdue (booking manager)",
    description: "Sent to the booking manager the day after a monthly invoice falls overdue.",
    subject: "Overdue invoice: {{customerName}} - {{facilityName}} {{period}}",
    body: "The monthly invoice for {{customerName}} ({{customerEmail}}, {{customerPhone}}) covering {{offeringName}} at {{facilityName}} for {{period}} was due on {{dueDate}} and is unpaid.\n\nAmount: {{amount}}\n\nUnless it is paid, the sessions will be released automatically on {{releaseDate}}. If they have paid by bank transfer, mark the invoice paid in the admin:\n{{adminUrl}}",
    variables: ["customerName", "customerEmail", "customerPhone", "facilityName", "offeringName", "period", "amount", "dueDate", "releaseDate", "adminUrl"],
  },
  {
    key: "booking_invoice_released",
    category: "bookings",
    name: "Sessions released for unpaid invoice",
    description: "Sent to the customer when a monthly invoice has gone unpaid past the grace period and the sessions have been released.",
    subject: "Your {{facilityName}} sessions have been released",
    body: "Hi {{customerName}},\n\nYour invoice for {{offeringName}} at {{facilityName}} covering {{period}} was not paid within seven days of its due date, so the following sessions have been released and your regular booking has ended:\n\n{{releasedDates}}\n\nThe invoice has been cancelled and nothing is owed. You are welcome to book again at any time:\n{{bookingUrl}}",
    variables: ["customerName", "facilityName", "offeringName", "period", "releasedDates", "bookingUrl"],
  },
  {
    key: "booking_invoice_released_manager",
    category: "bookings",
    name: "Sessions released for unpaid invoice (booking manager)",
    description: "Sent to the booking manager when a monthly invoice has gone unpaid past the grace period and the sessions have been released.",
    subject: "Released: {{customerName}} - {{facilityName}} {{period}}",
    body: "The monthly invoice for {{customerName}} ({{customerEmail}}) covering {{offeringName}} at {{facilityName}} for {{period}} went unpaid past the grace period. The invoice has been voided, the booking cancelled, and these sessions are now available:\n\n{{releasedDates}}",
    variables: ["customerName", "customerEmail", "facilityName", "offeringName", "period", "releasedDates"],
  },
  {
    key: "booking_reminder",
    category: "bookings",
    name: "Booking reminder and access",
    description: "Sent 24 hours before a confirmed booking.",
    subject: "Reminder: {{facilityName}} booking tomorrow",
    body: "Hi {{customerName}},\n\nThis is a reminder for your booking at {{facilityName}}.\n\nBooking: {{offeringName}}\nDate and time: {{startDate}} to {{endTime}}\n\nAccess information:\n{{accessInstructions}}",
    variables: ["customerName", "facilityName", "offeringName", "startDate", "endTime", "accessInstructions"],
  },
  {
    key: "booking_extension_conflict",
    category: "bookings",
    name: "Recurring booking extension conflict",
    description: "Sent to the booking manager when an ongoing subscription booking's future sessions clash with another booking and could not be added.",
    subject: "Action needed: {{count}} recurring session(s) could not be scheduled",
    body: "Some future sessions for ongoing subscription bookings could not be added because the slot is no longer available:\n\n{{conflicts}}\n\nThese sessions have NOT been booked. Please review and rebook or contact the customer. Billing for these subscriptions continues unaffected.",
    variables: ["count", "conflicts"],
  },
  {
    key: "booking_requirements_customer",
    category: "bookings",
    name: "Booking requirements reminder (customer)",
    description: "Sent to the customer when required questionnaire/documents are outstanding before the hire date.",
    subject: "Action needed for your {{facilityName}} booking",
    body: "Hi {{customerName}},\n\nYour booking at {{facilityName}} on {{startDate}} still needs some information before the hire date:\n\n{{outstanding}}\n\nPlease complete it here:\n{{bookingUrl}}",
    variables: ["customerName", "facilityName", "startDate", "outstanding", "bookingUrl"],
  },
  {
    key: "booking_requirements_manager",
    category: "bookings",
    name: "Booking requirements reminder (manager)",
    description: "Sent to the booking manager when a booking's required information is outstanding before the hire date.",
    subject: "Outstanding requirements: {{facilityName}} on {{startDate}}",
    body: "A booking still has outstanding requirements before the hire date.\n\nCustomer: {{customerName}}\nVenue: {{facilityName}}\nDate: {{startDate}}\n\nOutstanding:\n{{outstanding}}\n\nPlease chase the customer if needed.",
    variables: ["customerName", "facilityName", "startDate", "outstanding"],
  },
  {
    key: "lottery_welcome",
    category: "lottery",
    name: "Lottery welcome",
    description: "Sent when someone joins the lottery.",
    subject: "Welcome to the Loddiswell Community Lottery",
    body: "Hi {{name}},\n\nThank you for joining the Loddiswell Community Lottery.\n\nTickets: {{quantity}}\nTicket numbers: {{ticketNumbers}}\n\nEvery ticket helps maintain our village facilities.",
    variables: ["name", "quantity", "ticketNumbers", "manageUrl"],
  },
  {
    key: "lottery_payment_failed",
    category: "lottery",
    name: "Lottery payment failed",
    description: "Sent when a lottery subscription payment fails.",
    subject: "Payment issue with your lottery subscription",
    body: "Hi {{name}},\n\nThere was a problem taking payment for your Loddiswell Community Lottery subscription.\n\nPlease use the manage link to update your payment details.",
    variables: ["name", "manageUrl"],
  },
  {
    key: "lottery_draw_results",
    category: "lottery",
    name: "Lottery draw results",
    description: "Sent to active subscribers when draw results are published.",
    subject: "Loddiswell lottery results for {{drawDate}}",
    body: "Hello,\n\nHere are the results from the {{drawDate}} Loddiswell Community Lottery draw.\n\n{{winners}}\n\nThank you for supporting the lottery.",
    variables: ["drawDate", "winners", "notes"],
  },
  {
    key: "lottery_manage_link",
    category: "lottery",
    name: "Lottery manage link",
    description: "Sent when a customer requests a subscription management link.",
    subject: "Manage your Loddiswell lottery subscription",
    body: "Hi,\n\nUse the link below to manage your Loddiswell Community Lottery subscription, update payment details, cancel, or download invoices.\n\n{{manageUrl}}\n\nThis link will expire shortly.",
    variables: ["manageUrl"],
  },
];
