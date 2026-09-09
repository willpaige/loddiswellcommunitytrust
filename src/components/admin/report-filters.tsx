import Link from "next/link";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  formatDay,
  periodSearch,
  rangeOptions,
  toIsoDate,
  addUtcDays,
  type ReportPeriod,
} from "@/lib/reports";

// Filters are links and a plain GET form: the whole reporting section works with
// JavaScript switched off, and any period the user lands on is a URL they can
// bookmark or send to a fellow trustee.

export function ReportTabs({ period, active }: { period: ReportPeriod; active: string }) {
  const tabs = [
    { href: "/admin/reports", label: "Overview", key: "overview" },
    { href: "/admin/reports/bookings", label: "Bookings", key: "bookings" },
    { href: "/admin/reports/lottery", label: "Lottery", key: "lottery" },
  ];
  const query = periodSearch(period);
  return (
    <nav className="flex gap-1 border-b" aria-label="Report sections">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`${tab.href}?${query}`}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm font-medium no-underline transition-colors",
            tab.key === active
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function ReportFilters({
  period,
  basePath,
  exportName,
}: {
  period: ReportPeriod;
  basePath: string;
  /** Which CSV the Export button pulls: income, bookings or lottery. */
  exportName: "income" | "bookings" | "lottery";
}) {
  // The end is exclusive, so the last day the user picked is the day before it.
  const lastDay = addUtcDays(period.end, -1);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {rangeOptions.map((option) => (
          <Link
            key={option.key}
            href={`${basePath}?range=${option.key}`}
            aria-current={option.key === period.key ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium no-underline transition-colors",
              option.key === period.key
                ? "border-primary bg-secondary text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="range" value="custom" />
          <div>
            <label
              htmlFor="report-from"
              className="block text-xs font-medium text-muted-foreground"
            >
              From
            </label>
            <input
              id="report-from"
              type="date"
              name="from"
              defaultValue={toIsoDate(period.start)}
              className="mt-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <div>
            <label
              htmlFor="report-to"
              className="block text-xs font-medium text-muted-foreground"
            >
              To
            </label>
            <input
              id="report-to"
              type="date"
              name="to"
              defaultValue={toIsoDate(lastDay)}
              className="mt-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="h-9">
            Apply
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {period.key === "all"
              ? "Everything on record"
              : `${formatDay(period.start)} – ${formatDay(lastDay)}`}
          </p>
          <Button asChild variant="outline" size="sm" className="h-9">
            <a
              href={`/api/admin/reports/export?${periodSearch(period, { report: exportName })}`}
              download
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * How a number was arrived at, next to the number. A report that does not say
 * what it counts gets argued with at the next trustees' meeting.
 */
export function ReportNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}
