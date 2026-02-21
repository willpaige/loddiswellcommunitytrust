import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pt-32 pb-24 bg-background">
      <div className="mx-auto max-w-lg px-4 text-center">
        <p className="text-6xl font-serif text-copper-500">404</p>
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl tracking-tight">
          Page Not Found
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
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
