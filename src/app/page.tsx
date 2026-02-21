import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Ticket,
  Building2,
  TreePine,
  Trophy,
} from "lucide-react";

const facilities = [
  {
    name: "Village Hall",
    description:
      "Spacious hall for up to 100 people with kitchen, bar, and meeting room facilities.",
    href: "/facilities/village-hall",
    icon: Building2,
  },
  {
    name: "Pavilion",
    description:
      "Multi-purpose pavilion at the playing fields, ideal for sports events and gatherings.",
    href: "/facilities/pavilion",
    icon: TreePine,
  },
  {
    name: "Tennis Courts",
    description:
      "Community tennis courts available to book. Coaching and club sessions available.",
    href: "/facilities/tennis-courts",
    icon: Trophy,
  },
  {
    name: "Playing Field",
    description:
      "Open playing field for football, rounders, and other sports and community activities.",
    href: "/facilities/playing-field",
    icon: MapPin,
  },
];

const quickLinks = [
  {
    name: "Book a Facility",
    description: "Check availability and book the hall, pavilion, or courts.",
    href: "/booking",
    icon: CalendarDays,
    color: "bg-green-700 text-white",
  },
  {
    name: "Upcoming Events",
    description: "See what's happening in the Loddiswell community.",
    href: "/events",
    icon: CalendarDays,
    color: "bg-amber-400 text-white",
  },
  {
    name: "Community Lottery",
    description:
      "Support the trust and win prizes. Tickets just £12 per year.",
    href: "/lottery",
    icon: Ticket,
    color: "bg-green-600 text-white",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero Section with Video Background */}
      <section className="relative overflow-hidden text-white">
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-green-900/60" />
        {/* Content */}
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Welcome to Loddiswell
            </h1>
            <p className="mt-6 text-lg text-green-100 leading-relaxed">
              The Loddiswell Playing Field & Village Hall Trust maintains
              community facilities for the benefit of everyone in the parish.
              From our village hall and pavilion to tennis courts and playing
              fields — there&apos;s something for everyone.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/booking"
                className="inline-flex items-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-green-700 no-underline shadow-sm hover:bg-green-50 transition-colors"
              >
                Book a Facility
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center rounded-md border border-white/30 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-white/10 transition-colors"
              >
                About the Trust
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {quickLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`group rounded-xl ${link.color} p-6 no-underline shadow-sm hover:shadow-md transition-all`}
              >
                <link.icon className="h-8 w-8 mb-4" aria-hidden="true" />
                <h2 className="text-lg font-semibold">{link.name}</h2>
                <p className="mt-2 text-sm opacity-90">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Facilities Overview */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">
              Our Facilities
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              We maintain a range of community facilities in the heart of
              Loddiswell for residents, groups, and visitors to enjoy.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {facilities.map((facility) => (
              <Link
                key={facility.name}
                href={facility.href}
                className="group rounded-xl border border-border bg-white p-6 no-underline hover:border-green-300 hover:shadow-md transition-all"
              >
                <facility.icon
                  className="h-10 w-10 text-green-600 mb-4"
                  aria-hidden="true"
                />
                <h3 className="text-lg font-semibold text-foreground group-hover:text-green-700 transition-colors">
                  {facility.name}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {facility.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="py-16 bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                A Thriving Community
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Loddiswell is a vibrant village in the South Hams, Devon, with a
                rich history dating back to Roman times. Our community supports a
                wide range of clubs and societies including tennis, football,
                short mat bowls, cubs, art club, WI, and much more.
              </p>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                The Trust is run by a dedicated committee of volunteers who work
                to ensure our facilities are maintained and available for
                everyone to enjoy. Whether you&apos;re looking to book a venue,
                join a club, or support our community lottery, we&apos;d love to
                hear from you.
              </p>
              <div className="mt-6">
                <Link
                  href="/contact"
                  className="inline-flex items-center rounded-md bg-green-700 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-green-800 transition-colors"
                >
                  Get in Touch
                </Link>
              </div>
            </div>
            <div className="rounded-xl bg-green-100 p-8 text-center">
              <p className="text-5xl font-bold text-green-700">600+</p>
              <p className="mt-2 text-green-800 font-medium">
                Parish Residents
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4 text-left">
                <div className="rounded-lg bg-white p-4">
                  <p className="text-2xl font-bold text-green-700">5</p>
                  <p className="text-sm text-muted-foreground">
                    Community Facilities
                  </p>
                </div>
                <div className="rounded-lg bg-white p-4">
                  <p className="text-2xl font-bold text-green-700">10+</p>
                  <p className="text-sm text-muted-foreground">
                    Clubs & Societies
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
