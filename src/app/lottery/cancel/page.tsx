import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Lottery Purchase Cancelled",
};

export default function LotteryCancelPage() {
  return (
    <div className="py-24 bg-background">
      <div className="mx-auto max-w-lg px-4 text-center">
        <XCircle
          className="h-16 w-16 text-muted-foreground mx-auto"
          aria-hidden="true"
        />
        <h1 className="mt-6 text-3xl font-bold">Purchase Cancelled</h1>
        <p className="mt-4 text-muted-foreground">
          Your lottery ticket purchase was cancelled. No payment has been taken.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/lottery"
            className="inline-flex items-center rounded-md bg-primary-700 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-primary-800 transition-colors"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-border px-5 py-3 text-sm font-semibold text-foreground no-underline hover:bg-muted transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
