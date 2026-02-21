"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const navigation = [
  { name: "About", href: "/about" },
  { name: "Facilities", href: "/facilities" },
  { name: "Booking", href: "/booking" },
  { name: "Events", href: "/events" },
  { name: "Lottery", href: "/lottery" },
  { name: "Contact", href: "/contact" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 50);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const showSolid = scrolled || mobileMenuOpen;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        showSolid
          ? "bg-background/95 backdrop-blur-sm border-b border-border"
          : "bg-transparent"
      }`}
      role="banner"
    >
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <Link href="/" className="flex flex-col no-underline">
          <span
            className={`font-serif text-xl tracking-tight transition-colors ${
              showSolid ? "text-foreground" : "text-white"
            }`}
          >
            Loddiswell
          </span>
          <span
            className={`text-[10px] font-medium uppercase tracking-[0.15em] transition-colors ${
              showSolid ? "text-muted-foreground" : "text-white/70"
            }`}
          >
            Playing Field & Village Hall Trust
          </span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden lg:flex lg:gap-8">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`text-xs font-medium uppercase tracking-[0.1em] no-underline transition-colors ${
                showSolid
                  ? "text-foreground hover:text-copper-500"
                  : "text-white/90 hover:text-white"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className={`lg:hidden rounded-sm p-2 transition-colors ${
            showSolid
              ? "text-foreground hover:bg-muted"
              : "text-white hover:bg-white/10"
          }`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="space-y-1 px-4 py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block px-3 py-3 text-xs font-medium uppercase tracking-[0.1em] text-foreground no-underline hover:text-copper-500 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
