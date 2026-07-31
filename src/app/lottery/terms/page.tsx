import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline, renderRichText } from "@/lib/cms/render";
import { LOTTERY_SMALL_PRINT } from "@/lib/lottery/small-print";
import { LOTTERY_TERMS, LOTTERY_TERMS_VERSION } from "@/lib/lottery/terms";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("lottery-terms");
  return {
    title: title || "Lottery Terms & Conditions",
    description:
      metaDescription ||
      "Rules and terms and conditions for the Loddiswell Community Lottery, a small society lottery promoted by the Loddiswell Playing Fields & Village Hall Trust.",
  };
}

export default async function LotteryTermsPage() {
  const { blocks } = await getPageContent("lottery-terms");

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "Community Lottery")}
        title={renderInline(blocks.header_title, "Lottery Terms & Conditions")}
        subtitle={renderInline(
          blocks.header_subtitle,
          "The rules of the Loddiswell Community Lottery, a small society lottery promoted by the Loddiswell Playing Fields & Village Hall Trust."
        )}
      />

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10 text-muted-foreground leading-relaxed [&_p+p]:mt-3">
            {LOTTERY_TERMS.map((section, i) => (
              <div key={section.heading}>
                {renderRichText(
                  blocks[`section_${i + 1}`],
                  <>
                    <h2 className="font-serif text-xl mb-3 mt-0 text-foreground">
                      {i + 1}. {section.heading}
                    </h2>
                    {section.paragraphs.map((text, p) => (
                      <p key={p}>{text}</p>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 border-t border-border pt-8 text-xs text-muted-foreground leading-relaxed [&_p+p]:mt-3">
            {renderRichText(blocks.small_print, <p>{LOTTERY_SMALL_PRINT}</p>)}
            <p className="mt-4">
              {renderInline(
                blocks.last_updated,
                `Last updated: ${LOTTERY_TERMS_VERSION}`
              )}
            </p>
            <p className="mt-4">
              <Link
                href="/lottery"
                className="text-copper-600 hover:text-copper-700 underline"
              >
                Back to the Community Lottery
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
