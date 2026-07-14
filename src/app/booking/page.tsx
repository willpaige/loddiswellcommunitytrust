import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Clock, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionLabel } from "@/components/ui/section-label";
import { BookingForm } from "@/components/booking/booking-form";
import { BookingReview } from "@/components/booking/booking-review";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline } from "@/lib/cms/render";
import { getCustomerDiscountPercent, getPublicBookingData } from "@/actions/bookings";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("booking");
  return {
    title: title || "Book a Facility",
    description:
      metaDescription ||
      "Book the Loddiswell Village Hall, Pavilion, or Tennis Courts online.",
  };
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [{ blocks, heroImageUrl }, bookingData, session] = await Promise.all([
    getPageContent("booking"),
    getPublicBookingData(),
    auth(),
  ]);
  const pending = pendingBookingFromParams(params);
  const showReview = Boolean(session?.user?.email && pending);
  const initialDate = firstParam(params, "date");
  const customerDiscountPercent = session?.user?.email
    ? await getCustomerDiscountPercent(session.user.email)
    : 0;

  if (showReview && pending) {
    return (
      <>
        <style>{`header[role="banner"], footer, .newsletter-signup { display: none; } #main-content { padding: 0; }`}</style>
        <main className="relative flex min-h-screen items-center overflow-hidden bg-sage-800 px-4 py-16">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/hero-bg.jpg')" }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-sage-900/75" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-2xl">
            <p className="mb-6 text-center font-serif text-3xl tracking-tight text-white">
              Loddiswell Community Trust
            </p>
            <BookingReview
              offerings={bookingData.offerings}
              pending={pending}
              repeatDiscount={bookingData.repeatDiscount}
              customerDiscountPercent={customerDiscountPercent}
            />
          </div>
        </main>
      </>
    );
  }

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "Bookings")}
        title={renderInline(blocks.header_title, "Book a Facility")}
        subtitle={renderInline(
          blocks.header_subtitle,
          "Choose a venue, confirm availability, and pay securely online."
        )}
        heroImageUrl={heroImageUrl ?? undefined}
      />

      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {!showReview && (
            <>
              <SectionLabel>Instant confirmation</SectionLabel>
              <div className="mb-8 grid gap-4 sm:grid-cols-3">
                <div className="flex items-start gap-3">
                  <CalendarCheck className="mt-1 h-5 w-5 text-copper-500" aria-hidden="true" />
                  <div>
                    <h2 className="font-medium">Pick a slot</h2>
                    <p className="text-sm text-muted-foreground">
                      Village Hall, Pavilion, and Tennis Courts are available from one form.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-1 h-5 w-5 text-copper-500" aria-hidden="true" />
                  <div>
                    <h2 className="font-medium">Pay by card</h2>
                    <p className="text-sm text-muted-foreground">
                      Stripe handles one-off and monthly recurring payments.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="mt-1 h-5 w-5 text-copper-500" aria-hidden="true" />
                  <div>
                    <h2 className="font-medium">Manage online</h2>
                    <p className="text-sm text-muted-foreground">
                      View bookings and cancel eligible bookings from your account.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {bookingData.offerings.length > 0 ? (
            showReview && pending ? (
              <BookingReview
                offerings={bookingData.offerings}
                pending={pending}
                repeatDiscount={bookingData.repeatDiscount}
                customerDiscountPercent={customerDiscountPercent}
              />
            ) : (
              <BookingForm
                offerings={bookingData.offerings}
                repeatDiscount={bookingData.repeatDiscount}
                initialDate={initialDate}
                customerDiscountPercent={customerDiscountPercent}
              />
            )
          ) : (
            <div className="rounded-lg border p-8 text-center">
              <h2 className="font-serif text-2xl">Online booking is being configured</h2>
              <p className="mt-2 text-muted-foreground">
                Please contact the Trust while booking options are being added.
              </p>
              <Link className="mt-4 inline-flex text-primary underline" href="/contact">
                Contact us
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function pendingBookingFromParams(
  params: Record<string, string | string[] | undefined>
) {
  const offeringId = firstParam(params, "offeringId");
  const date = firstParam(params, "date");
  const customerGroup = firstParam(params, "customerGroup");
  const customerName = firstParam(params, "customerName");

  if (!offeringId || !date || !customerGroup || !customerName) return null;

  return {
    offeringId,
    date,
    time: firstParam(params, "time") || undefined,
    endTime: firstParam(params, "endTime") || undefined,
    customerGroup,
    recurrence: firstParam(params, "recurrence") || "none",
    repeatPaymentMode: firstParam(params, "repeatPaymentMode") || "subscription",
    repeatCount: firstParam(params, "repeatCount") || undefined,
    customerName,
    organisationName: firstParam(params, "organisationName") || undefined,
    customerPhone: firstParam(params, "customerPhone") || undefined,
    notes: firstParam(params, "notes") || undefined,
    promoteOnSite: firstParam(params, "promoteOnSite") || undefined,
    promotionUrl: firstParam(params, "promotionUrl") || undefined,
  };
}
