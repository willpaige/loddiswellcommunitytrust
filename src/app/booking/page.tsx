import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Phone, Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionLabel } from "@/components/ui/section-label";

export const metadata: Metadata = {
  title: "Booking",
  description:
    "Book the Loddiswell Village Hall, Pavilion, or Tennis Courts. Check availability and hire rates for all our community facilities.",
};

const hireFacilities = [
  {
    name: "Village Hall",
    description:
      "Spacious hall for up to 100 people with kitchen, bar, and meeting room.",
    rates: [
      { period: "Hourly rate", price: "Contact for rates" },
      { period: "Half day (4 hours)", price: "Contact for rates" },
      { period: "Full day", price: "Contact for rates" },
      { period: "Evening hire", price: "Contact for rates" },
    ],
    terms: [
      "A refundable deposit is required for all bookings",
      "The hirer is responsible for leaving the hall clean and tidy",
      "Bar facilities are available by arrangement",
      "Music must cease by 11:30pm",
    ],
  },
  {
    name: "Pavilion",
    description:
      "Multi-purpose pavilion at the playing fields with changing rooms.",
    rates: [
      { period: "Hourly rate", price: "Contact for rates" },
      { period: "Half day (4 hours)", price: "Contact for rates" },
      { period: "Full day", price: "Contact for rates" },
    ],
    terms: [
      "A refundable deposit is required for all bookings",
      "The hirer is responsible for leaving the pavilion clean and tidy",
    ],
  },
  {
    name: "Tennis Courts",
    description:
      "Community tennis courts available for visitors and club members.",
    rates: [{ period: "Per court per hour", price: "£6.00" }],
    terms: [
      "Collect the key from RS Stores (village Spar shop) — 01548 550258",
      "A key deposit is charged and refunded on return",
      "The key must be returned after each use",
      "Courts should be left in a clean condition",
    ],
    externalBookingUrl:
      "https://clubspark.lta.org.uk/LoddiswellTennisClub/Booking/BookByDate",
  },
];

export default function BookingPage() {
  return (
    <div>
      <PageHeader
        label="Hire Our Spaces"
        title="Book a Facility"
        subtitle="Check availability and hire rates for the Village Hall, Pavilion, and Tennis Courts. Contact us to make a booking."
      />

      {/* Booking Calendar Placeholder */}
      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionLabel>Availability</SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl mb-6">
            Availability Calendar
          </h2>
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">
              The online booking calendar is coming soon. In the meantime,
              please contact our Bookings Secretary to check availability.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <a
                href="tel:07716162407"
                className="inline-flex items-center gap-2 rounded-lg bg-sage-600 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-sage-700 transition-colors"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                07716 162407
              </a>
              <a
                href="mailto:hello@loddiswellcommunitytrust.org"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground no-underline hover:bg-muted transition-colors"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Hire Rates & Terms */}
      <section className="py-20 sm:py-24 bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl mb-8">
            Hire Rates & Terms
          </h2>
          <div className="space-y-8">
            {hireFacilities.map((facility) => (
              <div
                key={facility.name}
                className="rounded-lg border border-border bg-background p-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-serif text-xl">{facility.name}</h3>
                    <p className="mt-1 text-muted-foreground">
                      {facility.description}
                    </p>
                  </div>
                  {facility.externalBookingUrl && (
                    <a
                      href={facility.externalBookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-copper-500 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-copper-600 transition-colors flex-shrink-0"
                    >
                      Book Online
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Rates Table */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-500 mb-3">
                      Rates
                    </h4>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-sm font-medium text-foreground">
                            Period
                          </th>
                          <th className="text-right py-2 text-sm font-medium text-foreground">
                            Price
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {facility.rates.map((rate) => (
                          <tr
                            key={rate.period}
                            className="border-b border-border last:border-0"
                          >
                            <td className="py-2 text-sm text-muted-foreground">
                              {rate.period}
                            </td>
                            <td className="py-2 text-sm text-right font-medium">
                              {rate.price}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Terms */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-500 mb-3">
                      Terms of Hire
                    </h4>
                    <ul className="space-y-2">
                      {facility.terms.map((term) => (
                        <li
                          key={term}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-copper-500 mt-1.5 flex-shrink-0" />
                          {term}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 sm:py-24 bg-sage-800 text-sage-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <SectionLabel>Support</SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl">
            Need Help with Your Booking?
          </h2>
          <p className="mt-3 text-sage-200 max-w-xl mx-auto leading-relaxed">
            If you have any questions about hiring our facilities, please
            don&apos;t hesitate to get in touch.
          </p>
          <div className="mt-8">
            <Link
              href="/contact"
              className="inline-flex items-center rounded-lg bg-copper-500 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-copper-600 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
