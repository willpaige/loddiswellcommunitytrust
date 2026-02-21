import type { Metadata } from "next";
import Link from "next/link";
import { Building2, TreePine, Trophy, MapPin, Bike } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Facilities",
  description:
    "Explore Loddiswell's community facilities - Village Hall, Pavilion, Tennis Courts, Playing Field, and more. Available for hire and community use.",
};

const facilities = [
  {
    name: "Village Hall",
    slug: "village-hall",
    description:
      "A spacious venue suitable for up to 100 people, with a well-equipped kitchen adjacent to the main room, bar facilities, and a meeting room. Ideal for parties, celebrations, community events, and regular group meetings.",
    address: "South Brent Road, Loddiswell, TQ7 4RH",
    features: ["Capacity: 100", "Kitchen", "Bar", "Meeting Room", "Parking"],
    icon: Building2,
  },
  {
    name: "Pavilion",
    slug: "pavilion",
    description:
      "Multi-purpose pavilion building at the playing fields, perfect for sports events, outdoor gatherings, and community activities. Includes changing facilities and a covered area.",
    address: "Loddiswell Playing Fields, Loddiswell, TQ7 4QH",
    features: ["Changing Rooms", "Covered Area", "Adjacent to Playing Field"],
    icon: TreePine,
  },
  {
    name: "Tennis Courts",
    slug: "tennis-courts",
    description:
      "Community tennis courts managed by Loddiswell Tennis Club. Open to members and visitors. Courts are available at £6 per hour — collect the key from the village Spar shop (RS Stores).",
    address: "Loddiswell Playing Fields, Loddiswell, TQ7 4QH",
    features: [
      "£6 per hour",
      "Key from RS Stores",
      "Club sessions available",
      "Coaching",
    ],
    icon: Trophy,
  },
  {
    name: "Playing Field",
    slug: "playing-field",
    description:
      "Open playing field for football, rounders, and other sports and recreational activities. The field also serves as a landing site for the Devon Air Ambulance and hosts the annual Loddiswell Show.",
    address: "Loddiswell Playing Fields, Loddiswell, TQ7 4QH",
    features: [
      "Football",
      "Rounders",
      "Community Events",
      "Play Park",
      "Air Ambulance Landing Site",
    ],
    icon: MapPin,
  },
  {
    name: "Pump Track",
    slug: "pump-track",
    description:
      "A planned cycling facility featuring a circuit of small hills and banked corners, designed for bikes, scooters, and skateboards. Suitable for all skill levels and ages. Currently in the fundraising and planning stage.",
    address: "Loddiswell Playing Fields (planned)",
    features: [
      "All ages",
      "Bikes & Scooters",
      "Skateboards",
      "Coming Soon",
    ],
    icon: Bike,
  },
];

export default function FacilitiesPage() {
  return (
    <div>
      {/* Page Header */}
      <PageHeader
        label="What We Offer"
        title="Our Facilities"
        subtitle="We maintain a range of community facilities in the heart of Loddiswell for residents, groups, and visitors to enjoy."
      />

      {/* Facilities Grid */}
      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {facilities.map((facility) => (
              <Link
                key={facility.slug}
                href={`/facilities/${facility.slug}`}
                className="group block rounded-lg border border-border bg-card p-8 no-underline hover:border-copper-300 hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-sage-100 text-sage-700 group-hover:bg-sage-200 transition-colors">
                      <facility.icon className="h-8 w-8" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-foreground group-hover:text-copper-500 transition-colors">
                      {facility.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {facility.address}
                    </p>
                    <p className="mt-3 text-muted-foreground">
                      {facility.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {facility.features.map((feature) => (
                        <span
                          key={feature}
                          className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Booking CTA */}
      <section className="py-20 sm:py-24 bg-sage-800 text-sage-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl">
            Want to Book a Facility?
          </h2>
          <p className="mt-4 text-sage-200 max-w-xl mx-auto">
            Check availability and make a booking for the village hall, pavilion,
            or tennis courts.
          </p>
          <div className="mt-8">
            <Link
              href="/booking"
              className="inline-flex items-center rounded-md bg-copper-500 px-6 py-3 text-sm font-semibold text-white no-underline hover:bg-copper-600 transition-colors"
            >
              View Booking Information
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
