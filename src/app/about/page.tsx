import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Users, History } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionLabel } from "@/components/ui/section-label";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline, renderRichText } from "@/lib/cms/render";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("about");
  return {
    title: title || "About",
    description:
      metaDescription ||
      "Learn about the Loddiswell Playing Field & Village Hall Trust - our history, mission, and the trustees who keep our community facilities running.",
  };
}

const trustees = [
  { name: "Trustee 1", role: "Chair" },
  { name: "Trustee 2", role: "Vice Chair" },
  { name: "Trustee 3", role: "Treasurer" },
  { name: "Trustee 4", role: "Secretary" },
  { name: "Trustee 5", role: "Trustee" },
  { name: "Trustee 6", role: "Trustee" },
];

export default async function AboutPage() {
  const { blocks } = await getPageContent("about");

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "Who We Are")}
        title={renderInline(blocks.header_title, "About the Trust")}
        subtitle={renderInline(
          blocks.header_subtitle,
          "The Loddiswell Playing Fields and Village Hall Trust was formed to maintain and manage community facilities for the benefit of Loddiswell Parish inhabitants."
        )}
      />

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <History
                  className="h-8 w-8 text-sage-600"
                  aria-hidden="true"
                />
                <h2 className="font-serif text-2xl">
                  {renderInline(blocks.history_title, "Our History")}
                </h2>
              </div>
              <div className="text-muted-foreground space-y-4 leading-relaxed">
                {renderRichText(blocks.history_body)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Users className="h-8 w-8 text-sage-600" aria-hidden="true" />
                <h2 className="font-serif text-2xl">
                  {renderInline(blocks.mission_title, "Our Mission")}
                </h2>
              </div>
              <div className="text-muted-foreground space-y-4 leading-relaxed">
                {renderRichText(blocks.mission_body)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionLabel>
            {renderInline(blocks.trustees_eyebrow, "The Committee")}
          </SectionLabel>
          <h2 className="font-serif text-3xl sm:text-4xl mb-4">
            {renderInline(blocks.trustees_title, "Our Trustees")}
          </h2>
          <div className="text-muted-foreground mb-8 max-w-2xl">
            {renderRichText(
              blocks.trustees_intro,
              <p>
                The Trust is managed by a dedicated committee of volunteers from
                the local community. They give their time freely to ensure our
                facilities are well-maintained and available for everyone.
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trustees.map((trustee) => (
              <div
                key={trustee.name}
                className="rounded-lg border border-border p-4"
              >
                <p className="font-medium text-foreground">{trustee.name}</p>
                <p className="text-sm text-muted-foreground">{trustee.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <FileText className="h-8 w-8 text-sage-600" aria-hidden="true" />
            <h2 className="font-serif text-2xl">
              {renderInline(blocks.documents_title, "Documents")}
            </h2>
          </div>
          <div className="text-muted-foreground mb-8">
            {renderRichText(
              blocks.documents_intro,
              <p>
                Meeting minutes, AGM documents, and policies are available
                below. These are regularly updated by the Trust committee.
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <div className="text-muted-foreground">
              {renderRichText(
                blocks.documents_placeholder,
                <p>
                  Documents will be available here once uploaded by the Trust
                  committee.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-sage-800 text-sage-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl">
            {renderInline(blocks.cta_title, "Get Involved")}
          </h2>
          <div className="mt-4 text-sage-200 max-w-xl mx-auto">
            {renderRichText(
              blocks.cta_body,
              <p>
                Whether you&apos;d like to volunteer, join a club, or support
                the Trust through our community lottery, there are many ways to
                get involved.
              </p>
            )}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center rounded-md bg-copper-500 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-copper-600 transition-colors"
            >
              Contact Us
            </Link>
            <Link
              href="/lottery"
              className="inline-flex items-center rounded-md border border-sage-500 px-5 py-3 text-sm font-semibold text-sage-50 no-underline hover:bg-sage-700 transition-colors"
            >
              Join the Lottery
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
