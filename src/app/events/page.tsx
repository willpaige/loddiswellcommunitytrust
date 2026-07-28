import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { SectionLabel } from "@/components/ui/section-label";
import { AvailabilityCalendar } from "@/components/booking/availability-calendar";
import { getPageContent } from "@/lib/cms/get-page-content";
import {
  renderInline,
  renderRichText,
  type TiptapJSON,
} from "@/lib/cms/render";
import { getUpcomingEvents } from "@/actions/events";
import { getPublicAvailability } from "@/actions/bookings";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("events");
  return {
    title: title || "Events",
    description:
      metaDescription ||
      "Upcoming events in Loddiswell - community gatherings, sports, shows, and more at the Village Hall and Playing Fields.",
  };
}

function parseDescription(raw: string | null | undefined): TiptapJSON | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as TiptapJSON;
  } catch {
    return undefined;
  }
  return undefined;
}

function formatEventDate(
  startDate: Date,
  endDate: Date | null,
  allDay: boolean | null
): string {
  if (!endDate || isSameDay(startDate, endDate)) {
    return format(startDate, "EEEE d MMMM yyyy");
  }
  const sameMonth =
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear();
  if (sameMonth) {
    return `${format(startDate, "EEEE d")} – ${format(endDate, "d MMMM yyyy")}`;
  }
  return `${format(startDate, "d MMM")} – ${format(endDate, "d MMM yyyy")}`;
}

function formatEventTime(
  startDate: Date,
  endDate: Date | null,
  allDay: boolean | null
): string | null {
  if (allDay) return "All day";
  const start = format(startDate, "h:mma").toLowerCase();
  if (!endDate || !isSameDay(startDate, endDate)) return start;
  const end = format(endDate, "h:mma").toLowerCase();
  return `${start} – ${end}`;
}

export default async function EventsPage() {
  const [{ blocks, heroImageUrl }, upcoming, availability] = await Promise.all([
    getPageContent("events"),
    getUpcomingEvents(),
    getPublicAvailability(),
  ]);

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "What's On")}
        title={renderInline(blocks.header_title, "Events")}
        subtitle={renderInline(
          blocks.header_subtitle,
          "See what's happening in Loddiswell. From community gatherings and sports events to club meetings and celebrations."
        )}
        heroImageUrl={heroImageUrl ?? undefined}
      />

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionLabel>
            {renderInline(blocks.events_eyebrow, "Upcoming Events")}
          </SectionLabel>

          {upcoming.length > 0 && (
            <div className="space-y-6">
              {upcoming.map((event) => {
                const dateLabel = formatEventDate(
                  event.startDate,
                  event.endDate,
                  event.allDay
                );
                const timeLabel = formatEventTime(
                  event.startDate,
                  event.endDate,
                  event.allDay
                );
                const descJson = parseDescription(event.description);

                return (
                  <article
                    key={event.id}
                    className="rounded-lg border border-border bg-card p-8 hover:border-copper-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex flex-col sm:flex-row gap-6">
                      <div className="flex-shrink-0">
                        {event.imageUrl ? (
                          <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-lg">
                            <Image
                              src={event.imageUrl}
                              alt={event.title}
                              fill
                              sizes="112px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-sage-100 text-sage-700">
                            <CalendarDays
                              className="h-8 w-8"
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <h2 className="font-serif text-xl text-foreground">
                          {event.title}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                            {dateLabel}
                          </span>
                          {timeLabel && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" aria-hidden="true" />
                              {timeLabel}
                            </span>
                          )}
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" aria-hidden="true" />
                              {event.location}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 text-muted-foreground leading-relaxed space-y-3">
                          {renderRichText(descJson)}
                        </div>
                        {event.externalUrl && (
                          <Link
                            href={event.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex text-sm font-medium text-copper-600 underline-offset-4 hover:underline"
                          >
                            More information
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-12 rounded-lg border border-border bg-muted p-8 text-center">
            <CalendarDays
              className="h-12 w-12 text-muted-foreground mx-auto mb-4"
              aria-hidden="true"
            />
            <h3 className="font-serif text-lg">
              {renderInline(blocks.empty_state_title, "More Events Coming Soon")}
            </h3>
            <div className="mt-2 text-muted-foreground max-w-md mx-auto">
              {renderRichText(
                blocks.empty_state_body,
                <p>
                  Events will be regularly updated by the Trust committee. Check
                  back soon or follow us for the latest updates.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionLabel>Availability</SectionLabel>
          <AvailabilityCalendar
            items={availability}
            title="Venue calendar"
            description="Published events and team/community bookings. Select a date to start a booking."
            publicBookingHref="/booking"
          />
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-sage-800 text-sage-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <SectionLabel>
            {renderInline(blocks.cta_eyebrow, "Get Involved")}
          </SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl">
            {renderInline(blocks.cta_title, "Want to Host an Event?")}
          </h2>
          <div className="mt-3 text-sage-200 max-w-xl mx-auto leading-relaxed">
            {renderRichText(
              blocks.cta_body,
              <p>
                Our Village Hall and Pavilion are available for hire. Get in
                touch to discuss your event.
              </p>
            )}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/booking"
              className="inline-flex items-center rounded-lg bg-copper-500 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-copper-600 transition-colors"
            >
              Book a Venue
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-lg border border-sage-500 px-5 py-3 text-sm font-semibold text-sage-50 no-underline hover:bg-sage-700 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
