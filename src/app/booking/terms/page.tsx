import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { BookingTermsContent } from "@/components/booking/booking-terms-content";

export const metadata: Metadata = {
  title: "Conditions of Hire",
  description:
    "The terms and conditions for hiring the Loddiswell Village Hall, Pavilion and other Trust facilities.",
};

export default function BookingTermsPage() {
  return (
    <div>
      <PageHeader
        label="Bookings"
        title="Conditions of Hire"
        subtitle="The terms every hirer accepts when booking a Trust facility."
      />
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-3xl space-y-6 px-4 leading-relaxed text-muted-foreground sm:px-6 lg:px-8">
          <BookingTermsContent />
          <p className="pt-4">
            <Link href="/booking" className="text-copper-600 underline hover:text-copper-700">
              Back to booking
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
