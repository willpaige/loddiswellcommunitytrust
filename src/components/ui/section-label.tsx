export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper-500 mb-4">
      {children}
    </p>
  );
}
