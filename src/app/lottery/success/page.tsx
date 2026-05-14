import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Subscription confirmed",
};

export default function LotterySuccessPage() {
  return (
    <div className="pt-32 pb-24 bg-background">
      <div className="mx-auto max-w-lg px-4 text-center">
        <CheckCircle
          className="h-16 w-16 text-sage-500 mx-auto"
          aria-hidden="true"
        />
        <h1 className="mt-6 font-serif text-3xl sm:text-4xl tracking-tight">
          Thank you!
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Your lottery subscription is active. You&apos;re entered into every
          monthly draw, and your subscription will renew automatically. Good
          luck!
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ll receive a receipt from Stripe each billing cycle. To
          update your payment details or cancel, visit{" "}
          <Link
            href="/lottery/manage"
            className="text-copper-600 hover:text-copper-700 underline"
          >
            Manage your subscription
          </Link>
          .
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center rounded-sm bg-sage-600 px-5 py-3 text-sm font-medium tracking-wide text-white no-underline hover:bg-sage-700 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
