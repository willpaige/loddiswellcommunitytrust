import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline, renderRichText, firstParagraphText } from "@/lib/cms/render";
import { getFacilities } from "@/actions/facilities";
import { facilityIcon } from "@/lib/cms/facility-icons";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("facilities");
  return {
    title: title || "Facilities",
    description:
      metaDescription ||
      "Explore Loddiswell's community facilities - Village Hall, Pavilion, Tennis Courts, Playing Field, and more. Available for hire and community use.",
  };
}

export default async function FacilitiesPage() {
  const [{ blocks, heroImageUrl }, allFacilities] = await Promise.all([
    getPageContent("facilities"),
    getFacilities(),
  ]);
  const facilities = allFacilities.filter((f) => f.published);

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "What We Offer")}
        title={renderInline(blocks.header_title, "Our Facilities")}
        subtitle={renderInline(
          blocks.header_subtitle,
          "We maintain a range of community facilities in the heart of Loddiswell for residents, groups, and visitors to enjoy."
        )}
        heroImageUrl={heroImageUrl ?? undefined}
      />

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {facilities.map((facility) => {
              const Icon = facilityIcon(facility.slug);
              let descJson = undefined;
              try {
                descJson = JSON.parse(facility.description);
              } catch {
                descJson = undefined;
              }
              const lede = firstParagraphText(descJson, "");
              return (
                <Link
                  key={facility.slug}
                  href={`/facilities/${facility.slug}`}
                  className="group block rounded-lg border border-border bg-card p-8 no-underline hover:border-copper-300 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="flex-shrink-0">
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-sage-100 text-sage-700 group-hover:bg-sage-200 transition-colors">
                        <Icon className="h-8 w-8" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-foreground group-hover:text-copper-500 transition-colors">
                        {facility.name}
                      </h2>
                      {facility.address && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {facility.address}
                        </p>
                      )}
                      {lede && (
                        <p className="mt-3 text-muted-foreground">{lede}</p>
                      )}
                      {facility.features && facility.features.length > 0 && (
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
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-sage-800 text-sage-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl">
            {renderInline(blocks.cta_title, "Want to Book a Facility?")}
          </h2>
          <div className="mt-4 text-sage-200 max-w-xl mx-auto">
            {renderRichText(
              blocks.cta_body,
              <p>
                Check availability and make a booking for the village hall,
                pavilion, or tennis courts.
              </p>
            )}
          </div>
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
