interface PageHeaderProps {
  label?: string;
  title: string;
  subtitle?: string;
}

export function PageHeader({ label, title, subtitle }: PageHeaderProps) {
  return (
    <section className="bg-sage-800 text-sage-50 pt-36 sm:pt-40 pb-20 sm:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
      </div>
    </section>
  );
}
