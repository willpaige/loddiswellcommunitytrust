import type { Metadata } from "next";
import Link from "next/link";
import { Ticket, Gift, Heart, HelpCircle, Trophy } from "lucide-react";
import { format } from "date-fns";
import { LotteryCheckoutButton } from "@/components/lottery/checkout-button";
import { PageHeader } from "@/components/layout/page-header";
import { getPageContent } from "@/lib/cms/get-page-content";
import { renderInline, renderRichText } from "@/lib/cms/render";
import { getPublishedDraws } from "@/actions/lottery-draws";

export async function generateMetadata(): Promise<Metadata> {
  const { title, metaDescription } = await getPageContent("lottery");
  return {
    title: title || "Community Lottery",
    description:
      metaDescription ||
      "Join the Loddiswell Community Lottery! Tickets are just £12 per year. Support local facilities and win prizes.",
  };
}

function rankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

export default async function LotteryPage() {
  const [{ blocks }, draws] = await Promise.all([
    getPageContent("lottery"),
    getPublishedDraws(12),
  ]);

  const faqs = [1, 2, 3, 4].map((n) => ({
    question: blocks[`faq_q${n}`],
    answer: blocks[`faq_a${n}`],
  }));

  return (
    <div>
      <PageHeader
        label={renderInline(blocks.header_label, "Community Lottery")}
        title={renderInline(blocks.header_title, "Community Lottery")}
        subtitle={renderInline(
          blocks.header_subtitle,
          "Support the Trust and help maintain our community facilities. Every ticket makes a difference to Loddiswell."
        )}
      />

      <section className="py-20 sm:py-24 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-500 mb-3">
              {renderInline(blocks.how_it_works_eyebrow, "How It Works")}
            </p>
            <h2 className="font-serif text-3xl">
              {renderInline(blocks.how_it_works_title, "How It Works")}
            </h2>
            <div className="mt-3 text-muted-foreground max-w-xl mx-auto">
              {renderRichText(
                blocks.how_it_works_intro,
                <p>
                  It&apos;s simple — buy a ticket, support the village, and you
                  could win a prize!
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-copper-100 text-copper-600">
                <Ticket className="h-8 w-8" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                {renderInline(blocks.step_buy_title, "Buy a Ticket")}
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                {renderRichText(
                  blocks.step_buy_body,
                  <p>
                    Each ticket is just <strong>£12 for the year</strong> —
                    that&apos;s only £1 a month. Buy as many as you like!
                  </p>
                )}
              </div>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage-100 text-sage-600">
                <Gift className="h-8 w-8" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                {renderInline(blocks.step_draw_title, "Enter the Draw")}
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                {renderRichText(
                  blocks.step_draw_body,
                  <p>
                    Each ticket goes into the monthly draw for one full year
                    from the date of purchase.
                  </p>
                )}
              </div>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage-100 text-sage-600">
                <Heart className="h-8 w-8" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                {renderInline(blocks.step_support_title, "Support the Village")}
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                {renderRichText(
                  blocks.step_support_body,
                  <p>
                    All proceeds go directly to maintaining and improving
                    Loddiswell&apos;s community facilities.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24 bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="rounded-lg border-2 border-copper-200 bg-sage-50 p-8 sm:p-12">
              <h2 className="font-serif text-3xl text-sage-800">
                {renderInline(blocks.purchase_price, "£12 per ticket")}
              </h2>
              <p className="mt-2 text-sage-600">
                {renderInline(blocks.purchase_period, "per year")}
              </p>
              <div className="mt-4 text-muted-foreground">
                {renderRichText(
                  blocks.purchase_body,
                  <>
                    <p>
                      Each ticket is just £12 for the year — that&apos;s £1 a
                      month. Buy 2 or more tickets to make an even bigger
                      difference to the village!
                    </p>
                    <p className="mt-2 text-sm">
                      If you can afford more, then please do — every ticket
                      helps.
                    </p>
                  </>
                )}
              </div>

              <div className="mt-8">
                <LotteryCheckoutButton />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Already a subscriber?{" "}
                <Link
                  href="/lottery/manage"
                  className="text-copper-600 hover:text-copper-700 underline"
                >
                  Manage your subscription
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {draws.length > 0 && (
        <section className="py-20 sm:py-24 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="h-6 w-6 text-copper-500" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-500">
                Winners
              </p>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl mb-8">
              Recent monthly draws
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {draws.map((draw) => (
                <article
                  key={draw.id}
                  className="rounded-lg border border-border bg-card p-6"
                >
                  <h3 className="font-serif text-xl text-foreground">
                    {format(draw.drawDate, "MMMM yyyy")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Drawn {format(draw.drawDate, "d MMMM yyyy")}
                  </p>
                  {draw.results.length > 0 ? (
                    <ul className="mt-4 divide-y divide-border">
                      {draw.results.map((r) => (
                        <li
                          key={r.rank}
                          className="flex items-baseline gap-3 py-2"
                        >
                          <span className="text-sm font-semibold text-copper-600 w-10 flex-shrink-0">
                            {rankLabel(r.rank)}
                          </span>
                          <span className="font-medium text-foreground flex-1 truncate">
                            {r.winner || "—"}
                          </span>
                          {r.prize && (
                            <span className="text-sm text-muted-foreground">
                              {r.prize}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No winners listed.
                    </p>
                  )}
                  {draw.notes && (
                    <p className="mt-4 text-sm text-muted-foreground">
                      {draw.notes}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-20 sm:py-24 bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-500 mb-3">
            {renderInline(blocks.faq_eyebrow, "FAQ")}
          </p>
          <h2 className="font-serif text-2xl mb-8">
            {renderInline(blocks.faq_title, "Frequently Asked Questions")}
          </h2>
          <div className="space-y-6 max-w-3xl">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-6"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle
                    className="h-5 w-5 text-sage-600 mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-semibold">
                      {renderInline(faq.question, "Question")}
                    </h3>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {renderRichText(faq.answer)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
