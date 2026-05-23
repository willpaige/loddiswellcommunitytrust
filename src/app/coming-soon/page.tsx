import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coming Soon",
  description: "Loddiswell Community Trust website coming soon.",
};

export default function ComingSoonPage() {
  return (
    <>
      <style>{`header[role="banner"], footer, .newsletter-signup, .skip-link { display: none; } #main-content { min-height: 100vh; }`}</style>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sage-900 px-4 py-16 text-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-bg.jpg')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-sage-950/75" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl text-white">
          <p className="font-serif text-3xl tracking-tight sm:text-5xl">
            Loddiswell Community Trust
          </p>
          <h1 className="mt-8 text-sm font-semibold uppercase tracking-[0.24em] text-copper-200">
            Coming soon
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-sage-50/85 sm:text-lg">
            We are preparing the new website for the village hall, pavilion, tennis courts,
            events, and community facilities.
          </p>
        </div>
      </main>
    </>
  );
}
