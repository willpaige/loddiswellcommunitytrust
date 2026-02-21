import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  TreePine,
  Trophy,
  MapPin,
  Bike,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";

// Static facility data (will be replaced by CMS data once admin is built)
const facilitiesData: Record<
  string,
  {
    name: string;
    description: string;
    address: string;
    capacity?: number;
    features: string[];
    rates?: Record<string, string>;
    bookingInfo?: string;
    externalBookingUrl?: string;
    icon: React.ElementType;
  }
> = {
  "village-hall": {
    name: "Village Hall",
    description:
      "The Loddiswell Village Hall is a spacious, well-maintained venue suitable for up to 100 people. Located on South Brent Road next to the main car park, the hall features a well-equipped kitchen adjacent to the main room, bar facilities, and a separate meeting room.\n\nThe hall is ideal for private parties, celebrations, community events, regular group meetings, and more. It has been the heart of many community gatherings including the annual Loddiswell Show and various club activities.",
    address: "South Brent Road, Loddiswell, TQ7 4RH",
    capacity: 100,
    features: [
      "Main hall for up to 100 people",
      "Well-equipped kitchen",
      "Bar facilities",
      "Meeting room",
      "Adjacent car parking",
      "Accessible entrance",
    ],
    rates: {
      "Hourly rate": "Contact for rates",
      "Half day": "Contact for rates",
      "Full day": "Contact for rates",
      "Evening hire": "Contact for rates",
    },
    bookingInfo:
      "To check availability and make a booking, please contact our Bookings Secretary on 07716 162407 or email us.",
    icon: Building2,
  },
  pavilion: {
    name: "Pavilion",
    description:
      "The Pavilion Building is a multi-purpose facility located at the Loddiswell Playing Fields. It serves as a hub for sports activities and community events, with changing rooms and a covered area.\n\nThe pavilion is perfect for sports events, outdoor gatherings, and community activities. It provides essential facilities for teams using the playing fields and is available for private hire.",
    address: "Loddiswell Playing Fields, Loddiswell, TQ7 4QH",
    features: [
      "Changing rooms",
      "Covered area",
      "Adjacent to playing field",
      "Toilet facilities",
    ],
    rates: {
      "Hourly rate": "Contact for rates",
      "Half day": "Contact for rates",
      "Full day": "Contact for rates",
    },
    bookingInfo:
      "To check availability and make a booking, please contact our Bookings Secretary on 07716 162407 or email us.",
    icon: TreePine,
  },
  "tennis-courts": {
    name: "Tennis Courts",
    description:
      "The Loddiswell Tennis Courts are community facilities managed by the Loddiswell Tennis Club, part of the LTA. The courts are open to both members and visitors.\n\nVisitors can book courts at £6 per hour. A key for the visitors' gate must be collected from the village Spar shop (RS Stores) — a deposit is charged which is refunded when the key is returned.\n\nThe Tennis Club offers regular club sessions, coaching, and social events throughout the year. New members of all abilities are always welcome.",
    address: "Loddiswell Playing Fields, Loddiswell, TQ7 4QH",
    features: [
      "Visitors: £6 per hour",
      "Key from RS Stores (01548 550258)",
      "Club membership available",
      "Coaching sessions",
      "Social events",
    ],
    externalBookingUrl:
      "https://clubspark.lta.org.uk/LoddiswellTennisClub/Booking/BookByDate",
    bookingInfo:
      "Visitors: Collect the court key from RS Stores (the village Spar shop) — 01548 550258. A deposit is charged and refunded when the key is returned. For club membership and sessions, visit the ClubSpark page.",
    icon: Trophy,
  },
  "playing-field": {
    name: "Playing Field",
    description:
      "The Loddiswell Playing Field is a large, open green space available for sports and recreational activities. The field is used for football, rounders, and other community sports throughout the year.\n\nThe field also serves as a designated landing site for the Devon Air Ambulance (including night landings) and hosts the annual Loddiswell Show — a beloved community event celebrating its centenary in 2024.\n\nThe children's play park is located on the playing field and is open to all.",
    address: "Loddiswell Playing Fields, Loddiswell, TQ7 4QH",
    features: [
      "Football pitch",
      "Open space for rounders and sports",
      "Children's play park",
      "Devon Air Ambulance landing site",
      "Loddiswell Show venue",
    ],
    bookingInfo:
      "The playing field is generally open for community use. For organised events or regular bookings, please contact the Trust.",
    icon: MapPin,
  },
  "pump-track": {
    name: "Pump Track",
    description:
      "Plans are underway to build a pump track at Loddiswell Playing Fields — a modern cycling facility featuring a circuit of small hills and banked corners designed for bikes, scooters, and skateboards.\n\nThe pump track will be surfaced in tarmac or concrete, requiring minimal maintenance while providing year-round use. It is designed to work for all skill levels and ages, from young children to experienced riders.\n\nThe project aims to create a vibrant hub for healthy, inclusive recreation that fosters social interaction and offers a safe space for wheeled sports.",
    address: "Loddiswell Playing Fields (planned)",
    features: [
      "All ages and abilities",
      "Bikes, scooters, and skateboards",
      "Tarmac/concrete surface",
      "Year-round use",
      "Currently in planning/fundraising",
    ],
    bookingInfo:
      "The pump track is currently in the planning and fundraising stage. Watch this space for updates!",
    icon: Bike,
  },
};

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const facility = facilitiesData[slug];
  if (!facility) return { title: "Facility Not Found" };

  return {
    title: facility.name,
    description: facility.description.split("\n")[0],
  };
}

export function generateStaticParams() {
  return Object.keys(facilitiesData).map((slug) => ({ slug }));
}

export default async function FacilityPage({ params }: Props) {
  const { slug } = await params;
  const facility = facilitiesData[slug];

  if (!facility) {
    notFound();
  }

  const Icon = facility.icon;

  return (
    <div>
      {/* Page Header */}
      <section className="bg-sage-800 text-sage-50 pt-36 sm:pt-40 pb-20 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/facilities"
            className="inline-flex items-center gap-2 text-sm text-sage-300 no-underline hover:text-copper-300 mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All Facilities
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-sage-700">
              <Icon className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
              {facility.name}
            </h1>
          </div>
          <p className="mt-3 text-sage-300">{facility.address}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            {/* Main content */}
            <div className="lg:col-span-2">
              <SectionLabel>Overview</SectionLabel>
              <h2 className="font-serif text-2xl mb-6">About this Facility</h2>
              <div className="space-y-4">
                {facility.description.split("\n\n").map((paragraph, i) => (
                  <p key={i} className="text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Features */}
              <h3 className="font-serif text-xl mt-10 mb-4">Features</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {facility.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-muted-foreground"
                  >
                    <span className="h-2 w-2 rounded-full bg-copper-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Rates */}
              {facility.rates && (
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="font-serif text-lg mb-4">Hire Rates</h3>
                  <dl className="space-y-3">
                    {Object.entries(facility.rates).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd className="font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Booking Info */}
              {facility.bookingInfo && (
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="font-serif text-lg mb-4">
                    Booking Information
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {facility.bookingInfo}
                  </p>
                  {facility.externalBookingUrl && (
                    <a
                      href={facility.externalBookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 rounded-md bg-copper-500 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-copper-600 transition-colors"
                    >
                      Book Online
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                  {!facility.externalBookingUrl && slug !== "pump-track" && (
                    <Link
                      href="/booking"
                      className="mt-4 inline-flex items-center rounded-md bg-copper-500 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-copper-600 transition-colors"
                    >
                      Check Availability
                    </Link>
                  )}
                </div>
              )}

              {/* Location */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="font-serif text-lg mb-4">Location</h3>
                <p className="text-sm text-muted-foreground">
                  {facility.address}
                </p>
                <Link
                  href="/contact"
                  className="mt-4 inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-muted transition-colors"
                >
                  Get Directions
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
