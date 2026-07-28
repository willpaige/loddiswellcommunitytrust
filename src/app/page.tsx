import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Ticket,
  Building2,
  TreePine,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline, renderRichText } from "@/lib/cms/render";
import { getFacilities } from "@/actions/facilities";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { metaDescription } = await getPageContent("home");
  return {
    description:
      metaDescription ||
      "Community facilities for Loddiswell Parish - Village Hall, Pavilion, Playing Fields, Tennis Courts. Book facilities, find events, and join our community lottery.",
  };
}

const facilities = [
  {
    name: "Village Hall",
    description:
      "Spacious hall for up to 100 people with kitchen, bar, and meeting room.",
    href: "/facilities/village-hall",
    icon: Building2,
  },
  {
    name: "Pavilion",
    description:
      "Multi-purpose pavilion at the playing fields for sports and gatherings.",
    href: "/facilities/pavilion",
    icon: TreePine,
  },
  {
    name: "Tennis Courts",
    description: "Community tennis courts available to book via ClubSpark.",
    href: "/facilities/tennis-courts",
    icon: Trophy,
  },
  {
    name: "Playing Field",
    description:
      "Open playing field for football, rounders, and community activities.",
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
  },
  {
    name: "Upcoming Events",
    description: "See what’s happening in the Loddiswell community.",
    href: "/events",
    icon: CalendarDays,
  },
  {
    name: "Community Lottery",
    description:
      "Support the trust and win prizes. Tickets just £12 per year.",
    href: "/lottery",
    icon: Ticket,
  },
];

function renderHeroTitle(text: string) {
  // A forward slash splits the title across two lines.
  const parts = text.split("/").map((p) => p.trim());
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && <br />}
    </span>
  ));
}

export default async function HomePage() {
  const [{ blocks }, allFacilities] = await Promise.all([
    getPageContent("home"),
    getFacilities(),
  ]);

  const facilitiesCount = allFacilities.filter((f) => f.published).length;

  return (
    <div>
      <section className="relative overflow-hidden text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-bg.jpg')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-sage-900/70" />
        <div className="relative mx-auto max-w-7xl px-4 pt-40 pb-32 sm:px-6 sm:pt-48 sm:pb-40 lg:px-8 lg:pt-56 lg:pb-48">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-copper-300 mb-6">
              {renderInline(
                blocks.hero_eyebrow,
                "Loddiswell, South Hams, Devon"
              )}
            </p>
            <h1 className="font-serif text-6xl sm:text-7xl lg:text-8xl tracking-wide text-white leading-[1.1]">
              {renderHeroTitle(
                renderInline(blocks.hero_title, "Heart of the / Village")
              )}
            </h1>
            <div className="mt-6 text-lg text-sage-200 leading-relaxed max-w-xl">
              {renderRichText(
                blocks.hero_subtitle,
                <p>
                  The Playing Fields & Village Hall Trust maintains community
                  facilities for the benefit of everyone in Loddiswell Parish.
                </p>
              )}
            </div>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/booking"
                className="inline-flex items-center gap-2 rounded-sm bg-copper-500 px-6 py-3 text-sm font-medium tracking-wide text-white no-underline hover:bg-copper-600 transition-colors"
              >
                Book a Facility
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center rounded-sm border border-white/30 px-6 py-3 text-sm font-medium tracking-wide text-white no-underline hover:bg-white/10 transition-colors"
              >
                About the Trust
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {quickLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="group rounded-lg border-t-2 border-copper-500 bg-card p-8 no-underline shadow-sm hover:shadow-md transition-all"
              >
                <link.icon
                  className="h-5 w-5 text-copper-500 mb-4"
                  aria-hidden="true"
                />
                <h2 className="font-serif text-xl tracking-tight text-foreground">
                  {link.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {link.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-copper-500 uppercase tracking-wide group-hover:gap-2 transition-all">
                  Learn more
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-16">
            <SectionLabel>
              {renderInline(blocks.facilities_eyebrow, "Our Facilities")}
            </SectionLabel>
            <h2 className="font-serif text-3xl sm:text-4xl tracking-tight text-foreground">
              {renderInline(
                blocks.facilities_title,
                "Community Spaces for Everyone"
              )}
            </h2>
            <div className="mt-4 text-muted-foreground leading-relaxed">
              {renderRichText(
                blocks.facilities_body,
                <p>
                  We maintain a range of community facilities in the heart of
                  Loddiswell for residents, groups, and visitors to enjoy.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {facilities.map((facility) => (
              <Link
                key={facility.name}
                href={facility.href}
                className="group rounded-lg border border-border/60 bg-background p-8 no-underline hover:shadow-md hover:border-copper-400 transition-all"
              >
                <facility.icon
                  className="h-5 w-5 text-sage-500 mb-5"
                  aria-hidden="true"
                />
                <h3 className="font-serif text-xl tracking-tight text-foreground group-hover:text-copper-600 transition-colors">
                  {facility.name}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {facility.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 items-center">
            <div>
              <SectionLabel>
                {renderInline(blocks.community_eyebrow, "Our Village")}
              </SectionLabel>
              <h2 className="font-serif text-3xl sm:text-4xl tracking-tight text-foreground">
                {renderInline(blocks.community_title, "A Thriving Community")}
              </h2>
              <div className="mt-6 text-muted-foreground leading-relaxed space-y-4">
                {renderRichText(
                  blocks.community_body,
                  <>
                    <p>
                      Loddiswell is a vibrant village in the South Hams, Devon,
                      with a rich history dating back to Roman times. Our
                      community supports a wide range of clubs and societies
                      including tennis, football, short mat bowls, cubs, art
                      club, WI, and much more.
                    </p>
                    <p>
                      The Trust is run by a dedicated committee of volunteers
                      who work to ensure our facilities are maintained and
                      available for everyone to enjoy.
                    </p>
                  </>
                )}
              </div>
              <div className="mt-8">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 text-sm font-medium text-copper-600 no-underline hover:text-copper-700 uppercase tracking-wide transition-colors"
                >
                  Get in Touch
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="rounded-lg bg-sage-100 p-10">
              <p className="text-5xl font-serif text-copper-600">
                {renderInline(blocks.community_residents_number, "600+")}
              </p>
              <p className="mt-2 text-sage-700 font-medium">
                {renderInline(blocks.community_residents_label, "Parish Residents")}
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-card p-5">
                  <p className="text-2xl font-serif text-copper-600">{facilitiesCount}</p>
                  <p className="text-sm text-muted-foreground">
                    Community Facilities
                  </p>
                </div>
                <div className="rounded-lg bg-card p-5">
                  <p className="text-2xl font-serif text-copper-600">
                    {renderInline(blocks.community_clubs_number, "10+")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Clubs & Societies
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-sage-800 text-sage-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-300 mb-4">
            {renderInline(blocks.cta_eyebrow, "Support Loddiswell")}
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl tracking-tight">
            {renderInline(blocks.cta_title, "Join the Community Lottery")}
          </h2>
          <div className="mt-4 text-sage-200 max-w-xl mx-auto leading-relaxed">
            {renderRichText(
              blocks.cta_body,
              <p>
                Tickets are just &pound;12 per year. Support the maintenance of
                our community facilities and enter the monthly prize draw.
              </p>
            )}
          </div>
          <div className="mt-8">
            <Link
              href="/lottery"
              className="inline-flex items-center gap-2 rounded-sm bg-copper-500 px-6 py-3 text-sm font-medium tracking-wide text-white no-underline hover:bg-copper-600 transition-colors"
            >
              Buy Lottery Tickets
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
