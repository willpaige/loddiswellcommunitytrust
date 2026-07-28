"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { FiUser } from "react-icons/fi";
import { BrandLogo } from "@/components/layout/brand-logo";

const navigation = [
  { name: "About", href: "/about" },
  { name: "Facilities", href: "/facilities" },
  { name: "Events", href: "/events" },
  { name: "Lottery", href: "/lottery" },
  { name: "Contact", href: "/contact" },
];

export function Header() {
  const pathname = usePathname();
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

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

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
        <Link
          href="/"
          className="relative block aspect-[964/207] w-[190px] no-underline sm:w-[240px]"
          aria-label="Loddiswell Community Trust home"
        >
          <BrandLogo
            variant="light"
            decorative
            className={`absolute inset-0 transition-opacity duration-300 ${
              showSolid ? "opacity-0" : "opacity-100"
            }`}
          />
          <BrandLogo
            decorative
            className={`absolute inset-0 transition-opacity duration-300 ${
              showSolid ? "opacity-100" : "opacity-0"
            }`}
          />
        </Link>

        {/* Desktop navigation */}
        <div className="hidden lg:flex lg:items-center lg:gap-8">
          <div className="flex items-center gap-8">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative text-xs font-medium uppercase tracking-[0.1em] no-underline transition-colors after:absolute after:-bottom-2 after:left-0 after:h-px after:bg-copper-400 after:transition-all ${
                    active ? "after:w-full" : "after:w-0 hover:after:w-full"
                  } ${
                    showSolid
                      ? active
                        ? "text-copper-600 hover:text-copper-600"
                        : "text-foreground hover:text-copper-500"
                      : active
                        ? "text-white hover:text-white"
                        : "text-white/90 hover:text-white"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className={`group inline-flex h-8 w-8 items-center justify-center rounded-full border no-underline transition-colors ${
                showSolid
                  ? "border-foreground/30 text-foreground hover:border-copper-500 hover:text-copper-500"
                  : "border-white/75 text-white/90 hover:border-white hover:text-white"
              }`}
              aria-label="Account"
            >
              <FiUser className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
            </Link>
            <Link
              href="/booking"
              className="inline-flex items-center rounded-sm bg-copper-500 px-4 py-2 text-xs font-medium tracking-wide text-white no-underline hover:bg-copper-600 transition-colors"
            >
              Book Now
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <Link
            href="/account"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border no-underline transition-colors ${
              showSolid
                ? "border-foreground/30 text-foreground hover:border-copper-500 hover:text-copper-500"
                : "border-white/75 text-white hover:border-white"
            }`}
            aria-label="Account"
          >
            <FiUser className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className={`rounded-sm p-2 transition-colors ${
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
        </div>
      </nav>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="space-y-1 px-4 py-4">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-sm px-3 py-3 text-xs font-medium uppercase tracking-[0.1em] no-underline transition-colors ${
                    active
                      ? "bg-copper-50 text-copper-700"
                      : "text-foreground hover:bg-muted hover:text-copper-500"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              );
            })}
            <Link
              href="/account"
              className="block px-3 py-3 text-xs font-medium uppercase tracking-[0.1em] text-foreground no-underline hover:text-copper-500 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Account
            </Link>
            <Link
              href="/booking"
              className="mt-2 inline-flex w-full items-center justify-center rounded-sm bg-copper-500 px-4 py-3 text-xs font-medium uppercase tracking-[0.1em] text-white no-underline hover:bg-copper-600 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Book Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
