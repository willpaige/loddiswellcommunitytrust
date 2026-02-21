import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Lottery Purchase Cancelled",
};

export default function LotteryCancelPage() {
  return (
    <div className="pt-32 pb-24 bg-background">
      <div className="mx-auto max-w-lg px-4 text-center">
        <XCircle
          className="h-16 w-16 text-muted-foreground mx-auto"
          aria-hidden="true"
        />
        <h1 className="mt-6 font-serif text-3xl sm:text-4xl tracking-tight">
          Purchase Cancelled
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Your lottery ticket purchase was cancelled. No payment has been taken.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/lottery"
            className="inline-flex items-center rounded-sm bg-copper-500 px-5 py-3 text-sm font-medium tracking-wide text-white no-underline hover:bg-copper-600 transition-colors"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-sm border border-border px-5 py-3 text-sm font-medium tracking-wide text-foreground no-underline hover:bg-muted transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
