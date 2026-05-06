import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline, renderRichText } from "@/lib/cms/render";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("terms");
  return {
    title: title || "Terms & Conditions",
    description:
      metaDescription ||
      "Terms and conditions for the Loddiswell Playing Field & Village Hall Trust website.",
  };
}

export default async function TermsPage() {
  const { blocks } = await getPageContent("terms");

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "Legal")}
        title={renderInline(blocks.header_title, "Terms & Conditions")}
      />

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10 text-muted-foreground leading-relaxed">
            {Array.from({ length: 8 }).map((_, i) => {
              const key = `section_${i + 1}`;
              return <div key={key}>{renderRichText(blocks[key])}</div>;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
