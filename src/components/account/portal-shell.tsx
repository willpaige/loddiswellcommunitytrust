"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, Ticket } from "lucide-react";

const portalNav = [
  { name: "Overview", href: "/account", icon: LayoutDashboard },
  { name: "Bookings", href: "/account/bookings", icon: CalendarDays },
  { name: "Lottery", href: "/account/lottery", icon: Ticket },
];

export function AccountPortalShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const lotteryLive = Date.now() >= Date.parse("2026-07-31T23:00:00.000Z");

  return (
    <main className="bg-background pb-16">
      <section className="border-b bg-sage-800 text-sage-50">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-32 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-copper-200">
            Account
          </p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-serif text-4xl tracking-tight">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-sage-100/85">
                {description}
              </p>
            </div>
            <nav className="flex flex-wrap gap-2" aria-label="Account navigation">
              {portalNav.filter((item) => item.href !== "/account/lottery" || lotteryLive).map((item) => {
                const active =
                  item.href === "/account"
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "inline-flex h-10 items-center gap-2 rounded-sm border px-3 text-sm font-medium no-underline transition",
                      active
                        ? "border-copper-300 bg-copper-500 text-white"
                        : "border-sage-500 text-sage-50 hover:bg-sage-700",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {children}
      </section>
    </main>
  );
}
