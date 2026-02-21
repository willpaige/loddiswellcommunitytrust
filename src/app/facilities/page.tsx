import type { Metadata } from "next";
import Link from "next/link";
import { Building2, TreePine, Trophy, MapPin, Bike } from "lucide-react";

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
      <section className="bg-green-700 text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white">Our Facilities</h1>
          <p className="mt-4 text-lg text-green-100 max-w-2xl">
            We maintain a range of community facilities in the heart of
            Loddiswell for residents, groups, and visitors to enjoy.
          </p>
        </div>
      </section>

      {/* Facilities Grid */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {facilities.map((facility) => (
              <Link
                key={facility.slug}
                href={`/facilities/${facility.slug}`}
                className="group block rounded-xl border border-border bg-white p-8 no-underline hover:border-green-300 hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-green-100 text-green-700 group-hover:bg-green-200 transition-colors">
                      <facility.icon className="h-8 w-8" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground group-hover:text-green-700 transition-colors">
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
      <section className="py-16 bg-amber-400 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Want to Book a Facility?
          </h2>
          <p className="mt-4 text-white/90 max-w-xl mx-auto">
            Check availability and make a booking for the village hall, pavilion,
            or tennis courts.
          </p>
          <div className="mt-8">
            <Link
              href="/booking"
              className="inline-flex items-center rounded-md bg-white px-6 py-3 text-sm font-semibold text-amber-700 no-underline hover:bg-amber-50 transition-colors"
            >
              View Booking Information
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
