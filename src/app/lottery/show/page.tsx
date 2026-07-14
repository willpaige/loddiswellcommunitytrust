import type { Metadata } from "next";
import {
  CirclePoundSterling,
  HeartHandshake,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { LotteryCheckoutButton } from "@/components/lottery/checkout-button";

export const metadata: Metadata = {
  title: "Village Show Lottery Signup",
  description:
    "Quick signup for the Loddiswell Community Lottery at the village show.",
};

export default function LotteryShowSignupPage() {
  return (
    <div className="min-h-screen bg-sage-950 text-white">
      <section className="relative isolate flex min-h-screen items-center overflow-hidden px-4 py-28 sm:px-6 lg:px-8">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-bg.jpg')" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 -z-10 bg-sage-950/78"
          aria-hidden="true"
        />

        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div className="max-w-3xl">
            <h1 className="font-serif text-5xl leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Join the Loddiswell Community Lottery
            </h1>

            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-sage-100 sm:text-2xl">
              Pick your tickets now. It only takes a minute, costs £1 a month
              per ticket, and helps look after the village hall, playing fields,
              pavilion, play park, and tennis courts.
            </p>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="border-l-2 border-copper-300 pl-4">
                <CirclePoundSterling
                  className="h-7 w-7 text-copper-200"
                  aria-hidden="true"
                />
                <p className="mt-3 text-2xl font-semibold">£1</p>
                <p className="text-sm text-sage-200">per ticket each month</p>
              </div>
              <div className="border-l-2 border-copper-300 pl-4">
                <Ticket
                  className="h-7 w-7 text-copper-200"
                  aria-hidden="true"
                />
                <p className="mt-3 text-2xl font-semibold">12</p>
                <p className="text-sm text-sage-200">monthly draws a year</p>
              </div>
              <div className="border-l-2 border-copper-300 pl-4">
                <HeartHandshake
                  className="h-7 w-7 text-copper-200"
                  aria-hidden="true"
                />
                <p className="mt-3 text-2xl font-semibold">100%</p>
                <p className="text-sm text-sage-200">supports local facilities</p>
              </div>
            </div>
          </div>

          <div
            id="signup"
            className="rounded-lg border border-white/20 bg-stone-50 p-5 text-foreground shadow-2xl sm:p-7"
          >
            <div className="mb-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-sm bg-copper-500 text-white">
                <Ticket className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="mt-4 font-serif text-3xl text-sage-900">
                Quick signup
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Choose how many tickets you want, then complete payment
                securely. Your lottery numbers will be sent by email.
              </p>
            </div>

            <LotteryCheckoutButton defaultInterval="month" />

            <div className="mt-6 flex items-start gap-3 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck
                className="mt-0.5 h-5 w-5 flex-none text-sage-600"
                aria-hidden="true"
              />
              <p>
                Use your own email address at checkout. If this is a shared
                show computer, close the payment window when you are finished.
              </p>
            </div>
          </div>
        </div>

      </section>
    </div>
  );
}
