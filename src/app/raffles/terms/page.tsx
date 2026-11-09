import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline, renderRichText } from "@/lib/cms/render";
import { RAFFLE_TERMS, RAFFLE_TERMS_VERSION } from "@/lib/raffles/terms";
import { DEFAULT_RAFFLE_SMALL_PRINT } from "@/lib/raffles/small-print";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("raffle-terms");
  return {
    title: title || "Raffle Terms & Conditions",
    description:
      metaDescription ||
      "The rules for raffles run by the Loddiswell Playing Fields & Village Hall Trust, a small society lottery registered with South Hams District Council.",
  };
}

export default async function RaffleTermsPage() {
  const { blocks } = await getPageContent("raffle-terms");
  const smallPrint = DEFAULT_RAFFLE_SMALL_PRINT.replace(" Tickets {price} each. Draw {drawDate}.", "");

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "Raffles")}
        title={renderInline(blocks.header_title, "Raffle Terms & Conditions")}
        subtitle={renderInline(
          blocks.header_subtitle,
          "The rules for every raffle run by the Loddiswell Playing Fields & Village Hall Trust."
        )}
      />
      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-10 text-muted-foreground leading-relaxed [&_p+p]:mt-3">
            {RAFFLE_TERMS.map((section, i) => (
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
            {renderRichText(blocks.small_print, <p>{smallPrint}</p>)}
            <p className="mt-4">{renderInline(blocks.last_updated, `Last updated: ${RAFFLE_TERMS_VERSION}`)}</p>
            <p className="mt-4">
              <Link href="/raffles" className="text-copper-600 hover:text-copper-700 underline">
                Back to raffles
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
