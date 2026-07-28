import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Subscription confirmed",
};

export default async function LotterySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const params = await searchParams;
  const signedUpFromShow = params.source === "show";
  const ctaHref = signedUpFromShow ? "/lottery/show" : "/";
  const ctaLabel = signedUpFromShow ? "Back to Show Signup" : "Back to Home";

  return (
    <div>
      <section className="bg-sage-800 pt-36 sm:pt-40 pb-20 sm:pb-24">
        <div className="mx-auto max-w-lg px-4 text-center">
          <CheckCircle
            className="h-16 w-16 text-sage-300 mx-auto"
            aria-hidden="true"
          />
          <h1 className="mt-6 font-serif text-4xl sm:text-5xl tracking-tight text-sage-50">
            Thank you!
          </h1>
          <p className="mt-4 text-sage-200 leading-relaxed">
            Your lottery subscription is active. You&apos;re entered into every
            monthly draw, and your subscription will renew automatically. Good
            luck!
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="mx-auto max-w-lg px-4 text-center">
          <p className="text-sm text-muted-foreground">
            You&apos;ll receive a receipt from Stripe each billing cycle. To
            update your payment details or cancel, visit{" "}
            <Link
              href="/account/lottery"
              className="text-copper-600 hover:text-copper-700 underline"
            >
              Manage your subscription
            </Link>
            .
          </p>
          <div className="mt-8">
            <Link
              href={ctaHref}
              className="inline-flex items-center rounded-sm bg-sage-600 px-5 py-3 text-sm font-medium tracking-wide text-white no-underline hover:bg-sage-700 transition-colors"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
