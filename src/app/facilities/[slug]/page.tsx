import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { db } from "@/lib/db";
import { facilities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getFacility } from "@/actions/facilities";
import { facilityIcon } from "@/lib/cms/facility-icons";
import { formatWhat3words } from "@/lib/what3words";
import {
  firstParagraphText,
  renderRichText,
  type TiptapJSON,
} from "@/lib/cms/render";

type Props = {
  params: Promise<{ slug: string }>;
};

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const facility = await getFacility(slug);
  if (!facility) return { title: "Facility Not Found" };
  const lede = firstParagraphText(
    parseDescription(facility.description),
    facility.name
  );
  return { title: facility.name, description: lede };
}

export async function generateStaticParams() {
  const rows = await db
    .select({ slug: facilities.slug })
    .from(facilities)
    .where(eq(facilities.published, true));
  return rows.map((r) => ({ slug: r.slug }));
}

export default async function FacilityPage({ params }: Props) {
  const { slug } = await params;
  const facility = await getFacility(slug);
  if (!facility || !facility.published) notFound();

  const Icon = facilityIcon(slug);
  const descJson = parseDescription(facility.description);
  const what3words = formatWhat3words(facility.what3words);

  return (
    <div>
      <section className="relative overflow-hidden bg-sage-800 text-sage-50 pt-36 sm:pt-40 pb-20 sm:pb-24">
        {facility.heroImageUrl && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${facility.heroImageUrl}')` }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 bg-sage-900/70"
              aria-hidden="true"
            />
          </>
        )}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/facilities"
            className="inline-flex items-center gap-2 text-sm text-sage-300 no-underline hover:text-copper-300 mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All Facilities
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-sage-700/80 backdrop-blur-sm">
              <Icon className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
              {facility.name}
            </h1>
          </div>
          {facility.address && (
            <p className="mt-3 text-sage-200">{facility.address}</p>
          )}
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SectionLabel>Overview</SectionLabel>
              <h2 className="font-serif text-2xl mb-6">About this Facility</h2>
              <div className="text-muted-foreground leading-relaxed space-y-4">
                {renderRichText(descJson)}
              </div>

              {facility.features && facility.features.length > 0 && (
                <>
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
                </>
              )}
            </div>

            <div className="space-y-6">
              {facility.rates && Object.keys(facility.rates).length > 0 && (
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
                      {slug === "pump-track"
                        ? "Visit Pump Track Website"
                        : "Book Online"}
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

              {(facility.address || what3words) && (
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="font-serif text-lg mb-4">Location</h3>
                  {facility.address && (
                    <p className="text-sm text-muted-foreground">
                      {facility.address}
                    </p>
                  )}
                  {what3words && (
                    <a
                      href={what3words.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-copper-600 no-underline hover:text-copper-700"
                    >
                      {what3words.label}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                  <Link
                    href="/contact"
                    className="mt-4 inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-muted transition-colors"
                  >
                    Get Directions
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
