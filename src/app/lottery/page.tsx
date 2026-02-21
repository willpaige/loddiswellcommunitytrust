import type { Metadata } from "next";
import { Ticket, Gift, Heart, HelpCircle } from "lucide-react";
import { LotteryCheckoutButton } from "@/components/lottery/checkout-button";

export const metadata: Metadata = {
  title: "Community Lottery",
  description:
    "Join the Loddiswell Community Lottery! Tickets are just £12 per year. Support local facilities and win prizes.",
};

export default function LotteryPage() {
  return (
    <div>
      {/* Page Header */}
      <section className="bg-green-700 text-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white">Community Lottery</h1>
          <p className="mt-4 text-lg text-green-100 max-w-2xl">
            Support the Trust and help maintain our community facilities. Every
            ticket makes a difference to Loddiswell.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">How It Works</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              It&apos;s simple — buy a ticket, support the village, and you
              could win a prize!
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Ticket className="h-8 w-8" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Buy a Ticket</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Each ticket is just <strong>£12 for the year</strong> —
                that&apos;s only £1 a month. Buy as many as you like!
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Gift className="h-8 w-8" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Enter the Draw</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Each ticket goes into the monthly draw for one full year from
                the date of purchase.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                <Heart className="h-8 w-8" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Support the Village</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                All proceeds go directly to maintaining and improving
                Loddiswell&apos;s community facilities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ticket Purchase */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-8 sm:p-12">
              <h2 className="text-3xl font-bold text-green-800">
                £12 per ticket
              </h2>
              <p className="mt-2 text-green-700">per year</p>
              <p className="mt-4 text-muted-foreground">
                Each ticket is just £12 for the year — that&apos;s £1 a month.
                Buy 2 or more tickets to make an even bigger difference to the
                village!
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                If you can afford more, then please do — every ticket helps.
              </p>

              <div className="mt-8">
                <LotteryCheckoutButton />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-muted">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6 max-w-3xl">
            <div className="rounded-xl border border-border bg-white p-6">
              <div className="flex items-start gap-3">
                <HelpCircle
                  className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold">How much does a ticket cost?</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Each lottery ticket costs £12 per year. You can purchase as
                    many tickets as you like — each ticket is entered into every
                    monthly draw for a full year.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-6">
              <div className="flex items-start gap-3">
                <HelpCircle
                  className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold">How often are draws held?</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Draws are held monthly. Winners are announced through the
                    village newsletter and on this website.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-6">
              <div className="flex items-start gap-3">
                <HelpCircle
                  className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold">
                    Where does the money go?
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    All proceeds (minus prizes) go directly to the Loddiswell
                    Playing Fields and Village Hall Trust to maintain and improve
                    our community facilities — the Village Hall, Pavilion,
                    Playing Fields, Tennis Courts, and Play Park.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-6">
              <div className="flex items-start gap-3">
                <HelpCircle
                  className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold">
                    Can I buy more than one ticket?
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Absolutely! You can buy as many tickets as you like. Each
                    ticket gives you an additional entry into every monthly draw.
                    Buying 2 tickets for £24 doubles your chances and makes an
                    even bigger difference to the village.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
