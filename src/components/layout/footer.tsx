import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-sage-900 text-sage-100" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Trust info */}
          <div className="lg:col-span-5">
            <p className="font-serif text-2xl tracking-tight text-white">
              Loddiswell
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-sage-400 mt-1">
              Playing Field & Village Hall Trust
            </p>
            <p className="mt-6 text-sm text-sage-300 leading-relaxed max-w-sm">
              Maintaining community facilities for the benefit of Loddiswell
              Parish since 1965. A registered charity serving the South Hams, Devon.
            </p>
          </div>

          {/* Facilities */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-copper-400">
              Facilities
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/facilities/village-hall"
                  className="text-sm text-sage-300 hover:text-white no-underline transition-colors"
                >
                  Village Hall
                </Link>
              </li>
              <li>
                <Link
                  href="/facilities/pavilion"
                  className="text-sm text-sage-300 hover:text-white no-underline transition-colors"
                >
                  Pavilion
                </Link>
              </li>
              <li>
                <Link
                  href="/facilities/tennis-courts"
                  className="text-sm text-sage-300 hover:text-white no-underline transition-colors"
                >
                  Tennis Courts
                </Link>
              </li>
              <li>
                <Link
                  href="/facilities/playing-field"
                  className="text-sm text-sage-300 hover:text-white no-underline transition-colors"
                >
                  Playing Field
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-copper-400">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/booking"
                  className="text-sm text-sage-300 hover:text-white no-underline transition-colors"
                >
                  Book a Facility
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-sm text-sage-300 hover:text-white no-underline transition-colors"
                >
                  Events
                </Link>
              </li>
              <li>
                <Link
                  href="/lottery"
                  className="text-sm text-sage-300 hover:text-white no-underline transition-colors"
                >
                  Community Lottery
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-sm text-sage-300 hover:text-white no-underline transition-colors"
                >
                  About the Trust
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-copper-400">
              Contact
            </h3>
            <ul className="mt-4 space-y-3">
              <li className="text-sm text-sage-300">
                Village Hall, South Brent Road
              </li>
              <li className="text-sm text-sage-300">Loddiswell, TQ7 4RH</li>
              <li>
                <a
                  href="mailto:hello@loddiswellcommunitytrust.org"
                  className="text-sm text-sage-300 hover:text-white no-underline transition-colors"
                >
                  hello@loddiswellcommunitytrust.org
                </a>
              </li>
              <li>
                <a
                  href="tel:07716162407"
                  className="text-sm text-sage-300 hover:text-white no-underline transition-colors"
                >
                  07716 162407
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-sage-700 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-sage-400">
            &copy; {new Date().getFullYear()} Loddiswell Playing Field &
            Village Hall Trust. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="text-xs text-sage-400 hover:text-white no-underline transition-colors"
            >
              Terms & Conditions
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-sage-400 hover:text-white no-underline transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
