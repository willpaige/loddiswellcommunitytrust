import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Phone, Mail } from "lucide-react";

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
      {/* Page Header */}
      <section className="bg-green-700 text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white">Book a Facility</h1>
          <p className="mt-4 text-lg text-green-100 max-w-2xl">
            Check availability and hire rates for the Village Hall, Pavilion,
            and Tennis Courts. Contact us to make a booking.
          </p>
        </div>
      </section>

      {/* Booking Calendar Placeholder */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-6">Availability Calendar</h2>
          <div className="rounded-xl border border-border bg-white p-12 text-center">
            <p className="text-muted-foreground">
              The online booking calendar is coming soon. In the meantime,
              please contact our Bookings Secretary to check availability.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <a
                href="tel:07716162407"
                className="inline-flex items-center gap-2 rounded-md bg-green-700 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-green-800 transition-colors"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                07716 162407
              </a>
              <a
                href="mailto:hello@loddiswellcommunitytrust.org"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-semibold text-foreground no-underline hover:bg-muted transition-colors"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Hire Rates & Terms */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8">Hire Rates & Terms</h2>
          <div className="space-y-8">
            {hireFacilities.map((facility) => (
              <div
                key={facility.name}
                className="rounded-xl border border-border p-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-bold">{facility.name}</h3>
                    <p className="mt-1 text-muted-foreground">
                      {facility.description}
                    </p>
                  </div>
                  {facility.externalBookingUrl && (
                    <a
                      href={facility.externalBookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-green-800 transition-colors flex-shrink-0"
                    >
                      Book Online
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Rates Table */}
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
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
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Terms of Hire
                    </h4>
                    <ul className="space-y-2">
                      {facility.terms.map((term) => (
                        <li
                          key={term}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
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
      <section className="py-16 bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold">Need Help with Your Booking?</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            If you have any questions about hiring our facilities, please
            don&apos;t hesitate to get in touch.
          </p>
          <div className="mt-6">
            <Link
              href="/contact"
              className="inline-flex items-center rounded-md bg-green-700 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-green-800 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
