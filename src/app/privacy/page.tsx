import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline, renderRichText } from "@/lib/cms/render";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("privacy");
  return {
    title: title || "Privacy Policy",
    description:
      metaDescription ||
      "Privacy policy for the Loddiswell Playing Field & Village Hall Trust website.",
  };
}

export default async function PrivacyPage() {
  const { blocks } = await getPageContent("privacy");

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "Legal")}
        title={renderInline(blocks.header_title, "Privacy Policy")}
      />

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10 text-muted-foreground leading-relaxed">
            {Array.from({ length: 8 }).map((_, i) => {
              const key = `section_${i + 1}`;
              return <div key={key}>{renderRichText(blocks[key])}</div>;
            })}

            <div className="pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {renderInline(
                  blocks.last_updated,
                  "Last updated: February 2026"
                )}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
