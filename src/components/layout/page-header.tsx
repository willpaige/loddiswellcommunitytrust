import Link from "next/link";

interface PageHeaderProps {
  label?: string;
  title: string;
  subtitle?: string;
  heroImageUrl?: string;
  showBookingCta?: boolean;
}

export function PageHeader({ label, title, subtitle, heroImageUrl, showBookingCta }: PageHeaderProps) {
  return (
    <section className="relative overflow-hidden bg-sage-800 text-sage-50 pt-36 sm:pt-40 pb-20 sm:pb-24">
      {heroImageUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${heroImageUrl}')` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-sage-900/70"
            aria-hidden="true"
          />
        </>
      )}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {label && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-300 mb-4">
            {label}
          </p>
        )}
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 text-lg text-sage-200 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
        {showBookingCta && (
          <div className="mt-8">
            <Link
              href="/booking"
              className="inline-flex items-center rounded-sm bg-copper-500 px-5 py-3 text-sm font-medium tracking-wide text-white no-underline hover:bg-copper-600 transition-colors"
            >
              Book Now
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
