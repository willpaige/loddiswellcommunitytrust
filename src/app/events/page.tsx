import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Upcoming events in Loddiswell - community gatherings, sports, shows, and more at the Village Hall and Playing Fields.",
};

// Placeholder events (will be replaced by CMS data)
const sampleEvents = [
  {
    id: "1",
    title: "Loddiswell Show",
    description:
      "The annual Loddiswell Show returns! A celebration of local produce, crafts, sports, and community spirit. Fun for all the family.",
    location: "Loddiswell Playing Fields",
    date: "First Saturday in August",
    time: "10:00am - 5:00pm",
  },
  {
    id: "2",
    title: "Tennis Club Open Day",
    description:
      "Come and try tennis at Loddiswell! Free taster sessions for all ages and abilities. Rackets provided.",
    location: "Tennis Courts, Playing Fields",
    date: "Coming Soon",
    time: "2:00pm - 4:00pm",
  },
  {
    id: "3",
    title: "Trust AGM",
    description:
      "Annual General Meeting of the Loddiswell Playing Fields and Village Hall Trust. All parishioners welcome.",
    location: "Village Hall",
    date: "Coming Soon",
    time: "7:30pm",
  },
];

export default function EventsPage() {
  return (
    <div>
      {/* Page Header */}
      <section className="bg-primary-700 text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white">Events</h1>
          <p className="mt-4 text-lg text-primary-100 max-w-2xl">
            See what&apos;s happening in Loddiswell. From community gatherings
            and sports events to club meetings and celebrations.
          </p>
        </div>
      </section>

      {/* Events List */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {sampleEvents.map((event) => (
              <article
                key={event.id}
                className="rounded-xl border border-border bg-white p-8 hover:border-primary-300 hover:shadow-sm transition-all"
              >
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Date badge */}
                  <div className="flex-shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                      <CalendarDays className="h-8 w-8" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">
                      {event.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        {event.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        {event.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        {event.location}
                      </span>
                    </div>
                    <p className="mt-3 text-muted-foreground">
                      {event.description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Empty state info */}
          <div className="mt-12 rounded-xl border border-border bg-muted p-8 text-center">
            <CalendarDays
              className="h-12 w-12 text-muted-foreground mx-auto mb-4"
              aria-hidden="true"
            />
            <h3 className="text-lg font-semibold">More Events Coming Soon</h3>
            <p className="mt-2 text-muted-foreground max-w-md mx-auto">
              Events will be regularly updated by the Trust committee. Check back
              soon or follow us for the latest updates.
            </p>
          </div>
        </div>
      </section>

      {/* Host Event CTA */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold">Want to Host an Event?</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Our Village Hall and Pavilion are available for hire. Get in touch to
            discuss your event.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/booking"
              className="inline-flex items-center rounded-md bg-primary-700 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-primary-800 transition-colors"
            >
              Book a Venue
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-md border border-border px-5 py-3 text-sm font-semibold text-foreground no-underline hover:bg-muted transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
