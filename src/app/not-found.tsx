import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 bg-background">
      <div className="mx-auto max-w-lg px-4 text-center">
        <p className="text-6xl font-bold text-primary-700">404</p>
        <h1 className="mt-4 text-3xl font-bold">Page Not Found</h1>
        <p className="mt-4 text-muted-foreground">
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-primary-700 px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-primary-800 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
