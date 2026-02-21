import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-white" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Loddiswell Playing Field & Village Hall Trust
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Maintaining community facilities for the benefit of Loddiswell
              Parish inhabitants.
            </p>
          </div>

          {/* Facilities */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Facilities
            </h3>
            <ul className="mt-2 space-y-2">
              <li>
                <Link
                  href="/facilities/village-hall"
                  className="text-sm text-muted-foreground hover:text-foreground no-underline"
                >
                  Village Hall
                </Link>
              </li>
              <li>
                <Link
                  href="/facilities/pavilion"
                  className="text-sm text-muted-foreground hover:text-foreground no-underline"
                >
                  Pavilion
                </Link>
              </li>
              <li>
                <Link
                  href="/facilities/tennis-courts"
                  className="text-sm text-muted-foreground hover:text-foreground no-underline"
                >
                  Tennis Courts
                </Link>
              </li>
              <li>
                <Link
                  href="/facilities/playing-field"
                  className="text-sm text-muted-foreground hover:text-foreground no-underline"
                >
                  Playing Field
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Quick Links
            </h3>
            <ul className="mt-2 space-y-2">
              <li>
                <Link
                  href="/booking"
                  className="text-sm text-muted-foreground hover:text-foreground no-underline"
                >
                  Book a Facility
                </Link>
              </li>
              <li>
                <Link
                  href="/events"
                  className="text-sm text-muted-foreground hover:text-foreground no-underline"
                >
                  Events
                </Link>
              </li>
              <li>
                <Link
                  href="/lottery"
                  className="text-sm text-muted-foreground hover:text-foreground no-underline"
                >
                  Community Lottery
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-sm text-muted-foreground hover:text-foreground no-underline"
                >
                  About the Trust
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Contact</h3>
            <ul className="mt-2 space-y-2">
              <li className="text-sm text-muted-foreground">
                Village Hall, South Brent Road
              </li>
              <li className="text-sm text-muted-foreground">
                Loddiswell, TQ7 4RH
              </li>
              <li>
                <a
                  href="mailto:hello@loddiswellcommunitytrust.org"
                  className="text-sm text-muted-foreground hover:text-foreground no-underline"
                >
                  hello@loddiswellcommunitytrust.org
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Loddiswell Playing Field &
            Village Hall Trust. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link
              href="/terms"
              className="text-xs text-muted-foreground hover:text-foreground no-underline"
            >
              Terms & Conditions
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-muted-foreground hover:text-foreground no-underline"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
