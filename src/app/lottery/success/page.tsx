import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Lottery Purchase Complete",
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
          Thank You!
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Your lottery ticket purchase is complete. You&apos;re now entered into
          the monthly draw for the next 12 months. Good luck!
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          A confirmation email has been sent to your email address.
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
