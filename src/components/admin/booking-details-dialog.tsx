"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Repeat,
  User,
  X,
} from "lucide-react";
import { formatBookingDate } from "@/lib/booking-time";
import { bookingBalance, customerGroups, money, recurrenceLabel } from "@/lib/bookings";
import { getAdminBookingRequirements } from "@/actions/booking-requirements";
import type { BookingRequirementDetail } from "@/lib/booking-requirements";
import type { OccurrenceRow } from "@/components/admin/booking-occurrence-list";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type BookingDetails = {
  id: string;
  status: string;
  paymentType: string;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripeInvoiceId: string | null;
  invoiceStatus: string | null;
  invoiceHostedUrl: string | null;
  invoicePdfUrl: string | null;
  amount: number;
  paidAmount: number;
  unitAmount: number;
  pricingPercent: number;
  discountCode: string | null;
  discountPercent: number;
  discountAmount: number;
  customerGroup: string;
  customerName: string;
  organisationName: string | null;
  customerEmail: string;
  customerPhone: string | null;
  notes: string | null;
  billingLine1: string | null;
  billingLine2: string | null;
  billingCity: string | null;
  billingPostcode: string | null;
  startDate: Date;
  endDate: Date;
  recurrence: string;
  scheduleType: string;
  indefinite: boolean;
  billingInterval: string | null;
  repeatCount: number;
  promoteOnSite: boolean;
  promotionUrl: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  facilityName: string;
  offeringName: string | null;
};

type Props = {
  booking: BookingDetails;
  occurrences: OccurrenceRow[];
  hasRequirements: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-sage-100 text-sage-800 ring-sage-300",
  pending_payment: "bg-amber-50 text-amber-900 ring-amber-300",
  payment_failed: "bg-red-50 text-red-900 ring-red-300",
  cancelled: "bg-muted text-muted-foreground ring-border",
};

function Section({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-xs">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-primary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">
        {children ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "good" | "bad";
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-xs">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-serif text-xl leading-tight",
          tone === "good" && "text-primary",
          tone === "bad" && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-accent underline-offset-2 hover:underline">
      {children}
    </a>
  );
}

export function BookingDetailsDialog({ booking, occurrences, hasRequirements }: Props) {
  const [open, setOpen] = useState(false);
  const [requirements, setRequirements] = useState<BookingRequirementDetail | null>(null);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);

  // The answers and documents are only worth fetching once someone actually
  // opens the dialog, otherwise the list page would query them for every row.
  useEffect(() => {
    if (!open || !hasRequirements || requirements) return;
    let cancelled = false;
    getAdminBookingRequirements(booking.id)
      .then((result) => {
        if (!cancelled) setRequirements(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setRequirementsError(err instanceof Error ? err.message : "Could not load required information");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, hasRequirements, requirements, booking.id]);

  const balance = bookingBalance(booking);
  const groupLabel =
    customerGroups.find((group) => group.value === booking.customerGroup)?.label ?? booking.customerGroup;
  const billingAddress = [
    booking.billingLine1,
    booking.billingLine2,
    booking.billingCity,
    booking.billingPostcode,
  ].filter(Boolean);
  const sameDay =
    formatBookingDate(booking.startDate, "yyyy-MM-dd") === formatBookingDate(booking.endDate, "yyyy-MM-dd");
  const liveSessions = occurrences.filter((occurrence) => occurrence.status !== "cancelled").length;
  const scheduleLabel =
    booking.scheduleType === "custom"
      ? `Custom schedule · ${liveSessions} session${liveSessions === 1 ? "" : "s"}`
      : booking.recurrence === "none"
        ? "One-off booking"
        : `${recurrenceLabel(booking.recurrence)} · ${
            booking.indefinite
              ? "ongoing"
              : `${booking.repeatCount} session${booking.repeatCount === 1 ? "" : "s"}`
          }`;
  const stripeRefs = [
    ["Payment intent", booking.stripePaymentIntentId],
    ["Subscription", booking.stripeSubscriptionId],
    ["Customer", booking.stripeCustomerId],
    ["Invoice", booking.stripeInvoiceId],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const hasDiscount = Boolean(booking.discountCode) || booking.discountAmount > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="View booking"
          aria-label={`View booking for ${booking.customerName}`}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        {/* Header band */}
        <div className="relative bg-primary px-6 pt-5 pb-6 text-primary-foreground">
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 h-8 w-8 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogClose>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
            Booking
          </p>
          <DialogTitle className="mt-1 font-serif text-2xl leading-tight sm:text-3xl">
            {booking.facilityName}
            {booking.offeringName && (
              <span className="text-primary-foreground/70"> · {booking.offeringName}</span>
            )}
          </DialogTitle>
          <DialogDescription className="mt-1 text-primary-foreground/80">
            {booking.customerName}
            {booking.organisationName && ` · ${booking.organisationName}`}
          </DialogDescription>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
                STATUS_STYLES[booking.status] ?? STATUS_STYLES.cancelled
              )}
            >
              {booking.status.replace("_", " ")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/10 px-2.5 py-0.5 text-xs font-medium capitalize">
              <CreditCard className="h-3 w-3" aria-hidden="true" />
              {booking.paymentType.replace("_", " ")}
            </span>
            {booking.recurrence !== "none" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/10 px-2.5 py-0.5 text-xs font-medium">
                <Repeat className="h-3 w-3" aria-hidden="true" />
                {recurrenceLabel(booking.recurrence)}
              </span>
            )}
            {booking.promoteOnSite && (
              <span className="inline-flex items-center rounded-full bg-copper-400/30 px-2.5 py-0.5 text-xs font-medium">
                Promoted on site
              </span>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background p-6">
          {/* When */}
          <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-xs sm:flex-row sm:items-center">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-primary">
              <span className="text-[10px] font-semibold uppercase leading-none tracking-wider">
                {formatBookingDate(booking.startDate, "MMM")}
              </span>
              <span className="mt-0.5 font-serif text-2xl leading-none">
                {formatBookingDate(booking.startDate, "d")}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg leading-tight">
                {formatBookingDate(booking.startDate, "EEEE d MMMM yyyy")}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatBookingDate(booking.startDate, "HH:mm")} –{" "}
                {formatBookingDate(booking.endDate, sameDay ? "HH:mm" : "EEE d MMM yyyy, HH:mm")}
                <span className="mx-2 text-border">|</span>
                {scheduleLabel}
              </p>
            </div>
            {booking.billingInterval && (
              <div className="text-sm sm:text-right">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Billed</p>
                <p>{recurrenceLabel(booking.billingInterval)}</p>
              </div>
            )}
          </div>

          {/* Money */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Total" value={money(booking.amount)} />
            <Stat label="Paid" value={money(booking.paidAmount)} />
            <Stat
              label="Balance"
              tone={balance === 0 ? "good" : balance > 0 ? "bad" : "default"}
              value={
                balance === 0
                  ? "Settled"
                  : balance > 0
                    ? `${money(balance)} due`
                    : `${money(-balance)} to refund`
              }
            />
          </div>

          {booking.scheduleType === "custom" && occurrences.length > 0 && (
            <Section
              icon={CalendarDays}
              title="Sessions"
              aside={
                <span className="text-xs text-muted-foreground">
                  {liveSessions} of {occurrences.length} active
                </span>
              }
            >
              <ul className="divide-y rounded-md border text-sm">
                {occurrences.map((occurrence) => (
                  <li
                    key={occurrence.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <span
                      className={cn(
                        "tabular-nums",
                        occurrence.status === "cancelled" && "text-muted-foreground line-through"
                      )}
                    >
                      {formatBookingDate(occurrence.startDate, "EEE d MMM yyyy")}
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatBookingDate(occurrence.startDate, "HH:mm")}–
                        {formatBookingDate(occurrence.endDate, "HH:mm")}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">
                        {money(occurrence.allocatedAmount)}
                      </span>
                      {occurrence.status === "cancelled" && <Badge variant="secondary">Cancelled</Badge>}
                      {occurrence.refundStatus === "due" && <Badge variant="destructive">Refund due</Badge>}
                      {occurrence.refundStatus === "refunded" && <Badge variant="outline">Refunded</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section icon={User} title="Customer">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label="Name">{booking.customerName}</Field>
                <Field label="Customer type">{groupLabel}</Field>
                <Field label="Email">
                  <ExternalLink href={`mailto:${booking.customerEmail}`}>{booking.customerEmail}</ExternalLink>
                </Field>
                <Field label="Phone">
                  {booking.customerPhone ? (
                    <ExternalLink href={`tel:${booking.customerPhone}`}>{booking.customerPhone}</ExternalLink>
                  ) : undefined}
                </Field>
                <Field label="Organisation / event">
                  {booking.organisationName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {booking.organisationName}
                    </span>
                  ) : undefined}
                </Field>
                <Field label="Billing address">
                  {billingAddress.length > 0 ? (
                    <span className="inline-flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span>{billingAddress.join(", ")}</span>
                    </span>
                  ) : undefined}
                </Field>
              </dl>
            </Section>

            <Section icon={CreditCard} title="Payment">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label="Rate">
                  {booking.unitAmount > 0 ? (
                    <>
                      {money(booking.unitAmount)}
                      {booking.pricingPercent !== 0 && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({booking.pricingPercent > 0 ? "+" : ""}
                          {booking.pricingPercent}%)
                        </span>
                      )}
                    </>
                  ) : undefined}
                </Field>
                <Field label="Discount">
                  {hasDiscount ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {booking.discountCode && (
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{booking.discountCode}</code>
                      )}
                      <span>
                        {booking.discountPercent > 0 && `${booking.discountPercent}% · `}
                        {money(booking.discountAmount)} off
                      </span>
                    </span>
                  ) : (
                    "None"
                  )}
                </Field>
                <Field label="Invoice">
                  {booking.invoiceStatus ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant={booking.invoiceStatus === "paid" ? "default" : "outline"}>
                        {booking.invoiceStatus === "open" ? "unpaid" : booking.invoiceStatus}
                      </Badge>
                      {booking.invoiceHostedUrl && (
                        <ExternalLink href={booking.invoiceHostedUrl}>View</ExternalLink>
                      )}
                      {booking.invoicePdfUrl && <ExternalLink href={booking.invoicePdfUrl}>PDF</ExternalLink>}
                    </span>
                  ) : undefined}
                </Field>
                <Field label="Promotion">
                  {booking.promoteOnSite ? (
                    booking.promotionUrl ? (
                      <ExternalLink href={booking.promotionUrl}>{booking.promotionUrl}</ExternalLink>
                    ) : (
                      "Promoted on site"
                    )
                  ) : (
                    "Not promoted"
                  )}
                </Field>
              </dl>
              {stripeRefs.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                    Stripe references
                  </summary>
                  <dl className="mt-2 space-y-1">
                    {stripeRefs.map(([label, value]) => (
                      <div key={label} className="flex flex-wrap items-baseline gap-x-2">
                        <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
                        <dd className="break-all">
                          <code className="text-xs">{value}</code>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </Section>
          </div>

          {booking.notes && (
            <Section icon={FileText} title="Notes">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{booking.notes}</p>
            </Section>
          )}

          {hasRequirements && (
            <Section
              icon={ClipboardList}
              title="Required information"
              aside={
                requirements && (
                  <Badge variant={requirements.complete ? "default" : "destructive"}>
                    {requirements.complete ? "Complete" : "Outstanding"}
                  </Badge>
                )
              }
            >
              {requirementsError ? (
                <p className="text-sm text-destructive">{requirementsError}</p>
              ) : !requirements ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Loading…
                </p>
              ) : (
                <ul className="divide-y">
                  {requirements.questions.map((question) => {
                    const answer =
                      question.type === "yes_no"
                        ? question.answerBool === true
                          ? "Yes"
                          : question.answerBool === false
                            ? "No"
                            : null
                        : question.answerText || null;
                    return (
                      <li key={question.questionId} className="py-2.5 first:pt-0 last:pb-0">
                        <p className="text-sm font-medium">{question.label}</p>
                        <p className={cn("text-sm", answer ? "text-muted-foreground" : "text-destructive")}>
                          {answer ?? "Not answered"}
                        </p>
                        {question.needsDocument &&
                          (question.documents.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {question.documents.map((doc) => (
                                <li key={doc.id} className="text-sm">
                                  <ExternalLink href={doc.fileUrl}>
                                    {question.documentLabel || "Document"}: {doc.fileName}
                                  </ExternalLink>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm text-destructive">
                              {question.documentLabel || "Document"} not uploaded
                            </p>
                          ))}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Created {formatBookingDate(booking.createdAt, "d MMM yyyy, HH:mm")}
            </span>
            <span>Updated {formatBookingDate(booking.updatedAt, "d MMM yyyy, HH:mm")}</span>
            {booking.cancelledAt && (
              <span className="text-destructive">
                Cancelled {formatBookingDate(booking.cancelledAt, "d MMM yyyy, HH:mm")}
              </span>
            )}
            <span className="ml-auto">
              ID <code>{booking.id}</code>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-card px-6 py-4">
          <DialogClose asChild>
            <Button variant="outline" type="button">
              Close
            </Button>
          </DialogClose>
          <Button asChild>
            <Link href={`/admin/bookings/${booking.id}/edit`}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit booking
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
