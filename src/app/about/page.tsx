import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FileText, Users, History, Download } from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline, renderRichText } from "@/lib/cms/render";
import { getDocuments } from "@/actions/documents";
import { getPublishedTrustees } from "@/actions/trustees";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("about");
  return {
    title: title || "About",
    description:
      metaDescription ||
      "Learn about the Loddiswell Playing Fields & Village Hall Trust - our history, mission, and the trustees who keep our community facilities running.",
  };
}

const categoryLabels: Record<string, string> = {
  minutes: "Meeting Minutes",
  agm: "AGM Documents",
  policy: "Policies",
  report: "Reports",
  other: "Other",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AboutPage() {
  const [{ blocks, heroImageUrl }, documents, trustees] = await Promise.all([
    getPageContent("about"),
    getDocuments(),
    getPublishedTrustees(),
  ]);

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "Who We Are")}
        title={renderInline(blocks.header_title, "About the Trust")}
        subtitle={renderInline(
          blocks.header_subtitle,
          "The Loddiswell Playing Fields and Village Hall Trust was formed to maintain and manage community facilities for the benefit of Loddiswell Parish inhabitants."
        )}
        heroImageUrl={heroImageUrl ?? undefined}
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
          {trustees.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trustees.map((trustee) => (
                <div
                  key={trustee.id}
                  className="flex items-start gap-4 rounded-lg border border-border bg-background p-5"
                >
                  {trustee.photoUrl ? (
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full">
                      <Image
                        src={trustee.photoUrl}
                        alt={`Photo of ${trustee.name}`}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage-700 font-serif text-lg">
                      {trustee.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {trustee.name}
                    </p>
                    <p className="text-sm text-copper-600">{trustee.role}</p>
                    {trustee.bio && (
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        {trustee.bio}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {documents.length > 0 && (
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
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-4 px-6 py-4 no-underline hover:bg-muted/40 transition-colors"
                  >
                    <FileText
                      className="h-5 w-5 text-sage-600 mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-foreground truncate">
                          {doc.title}
                        </p>
                        <Badge variant="secondary" className="flex-shrink-0">
                          {categoryLabels[doc.category] ?? doc.category}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {doc.publishedDate &&
                          `${format(doc.publishedDate, "d MMM yyyy")} · `}
                        {doc.fileName}
                        {doc.fileSize ? ` · ${formatBytes(doc.fileSize)}` : ""}
                      </p>
                    </div>
                    <Download
                      className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

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
