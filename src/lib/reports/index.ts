// Reporting periods and formatting.
//
// Every figure on the reports is worked out in UTC. Booking times are UK
// wall-clock values stored in the UTC fields of a timestamp column (see
// booking-time.ts) and the app runs with TZ=UTC, so a "day" here is the same day
// the rest of the admin shows. Doing the arithmetic explicitly in UTC keeps that
// true even if something runs the code with another timezone set.

export type RangeKey =
  | "last_30"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_fy"
  | "last_fy"
  | "this_year"
  | "last_12"
  | "all"
  | "custom";

export type Granularity = "day" | "week" | "month";

export type ReportPeriod = {
  key: RangeKey;
  label: string;
  /** Inclusive. */
  start: Date;
  /** Exclusive, so a whole final day is counted. */
  end: Date;
  /** The equally long run-up to `start`, for comparisons. Null for all time. */
  previous: { start: Date; end: Date } | null;
  granularity: Granularity;
  /** Round trips back into the URL so links keep the current filter. */
  params: { range: RangeKey; from?: string; to?: string };
};

// The Trust reports on the UK charity financial year, April to March.
const FY_START_MONTH = 3; // April, zero-indexed

const EPOCH = Date.UTC(2015, 0, 1);

export function utcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addUtcMonths(date: Date, months: number) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes()
    )
  );
}

export function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Monday, matching how the rest of the site reads a week. */
export function startOfUtcWeek(date: Date) {
  const day = utcDay(date);
  const weekday = (day.getUTCDay() + 6) % 7;
  return addUtcDays(day, -weekday);
}

export function financialYearStart(date: Date) {
  const year =
    date.getUTCMonth() >= FY_START_MONTH
      ? date.getUTCFullYear()
      : date.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, FY_START_MONTH, 1));
}

export function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function pickGranularity(start: Date, end: Date): Granularity {
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  return "month";
}

export const rangeOptions: Array<{ key: RangeKey; label: string }> = [
  { key: "last_30", label: "Last 30 days" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_quarter", label: "This quarter" },
  { key: "last_12", label: "Last 12 months" },
  { key: "this_fy", label: "This financial year" },
  { key: "last_fy", label: "Last financial year" },
  { key: "this_year", label: "This calendar year" },
  { key: "all", label: "All time" },
];

export const DEFAULT_RANGE: RangeKey = "this_fy";

export function resolvePeriod(
  searchParams: { range?: string; from?: string; to?: string },
  now = new Date()
): ReportPeriod {
  const today = utcDay(now);
  const tomorrow = addUtcDays(today, 1);
  const requested = (searchParams.range ?? DEFAULT_RANGE) as RangeKey;

  const build = (
    key: RangeKey,
    label: string,
    start: Date,
    end: Date,
    withPrevious = true
  ): ReportPeriod => {
    const span = end.getTime() - start.getTime();
    return {
      key,
      label,
      start,
      end,
      previous: withPrevious
        ? { start: new Date(start.getTime() - span), end: start }
        : null,
      granularity: pickGranularity(start, end),
      params: { range: key },
    };
  };

  switch (requested) {
    case "custom": {
      const from = parseIsoDate(searchParams.from);
      const to = parseIsoDate(searchParams.to);
      if (from && to && to.getTime() >= from.getTime()) {
        const end = addUtcDays(to, 1);
        const period = build(
          "custom",
          `${formatDay(from)} – ${formatDay(to)}`,
          from,
          end
        );
        return {
          ...period,
          params: { range: "custom", from: toIsoDate(from), to: toIsoDate(to) },
        };
      }
      break;
    }
    case "last_30":
      return build("last_30", "Last 30 days", addUtcDays(tomorrow, -30), tomorrow);
    case "this_month":
      return build(
        "this_month",
        formatMonth(today),
        startOfUtcMonth(today),
        addUtcMonths(startOfUtcMonth(today), 1)
      );
    case "last_month": {
      const start = addUtcMonths(startOfUtcMonth(today), -1);
      return build("last_month", formatMonth(start), start, startOfUtcMonth(today));
    }
    case "this_quarter": {
      const quarterMonth = Math.floor(today.getUTCMonth() / 3) * 3;
      const start = new Date(Date.UTC(today.getUTCFullYear(), quarterMonth, 1));
      return build("this_quarter", "This quarter", start, addUtcMonths(start, 3));
    }
    case "last_12":
      return build(
        "last_12",
        "Last 12 months",
        addUtcMonths(startOfUtcMonth(today), -11),
        addUtcMonths(startOfUtcMonth(today), 1)
      );
    case "last_fy": {
      const start = addUtcMonths(financialYearStart(today), -12);
      return build("last_fy", financialYearLabel(start), start, financialYearStart(today));
    }
    case "this_year":
      return build(
        "this_year",
        String(today.getUTCFullYear()),
        new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
        new Date(Date.UTC(today.getUTCFullYear() + 1, 0, 1))
      );
    case "all":
      return build("all", "All time", new Date(EPOCH), tomorrow, false);
    case "this_fy":
    default:
      break;
  }

  const fyStart = financialYearStart(today);
  return build("this_fy", financialYearLabel(fyStart), fyStart, addUtcMonths(fyStart, 12));
}

export function financialYearLabel(start: Date) {
  const year = start.getUTCFullYear();
  return `FY ${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortDayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

export function formatDay(date: Date) {
  return dayFormatter.format(date);
}

export function formatShortDay(date: Date) {
  return shortDayFormatter.format(date);
}

export function formatMonth(date: Date) {
  return monthFormatter.format(date);
}

export function bucketLabel(date: Date, granularity: Granularity) {
  if (granularity === "month") return shortMonthFormatter.format(date);
  if (granularity === "week") return `w/c ${shortDayFormatter.format(date)}`;
  return shortDayFormatter.format(date);
}

/** Every bucket between start and end, so quiet periods show as gaps not absences. */
export function bucketRange(period: ReportPeriod): Date[] {
  const buckets: Date[] = [];
  const startOfBucket = (date: Date) =>
    period.granularity === "month"
      ? startOfUtcMonth(date)
      : period.granularity === "week"
        ? startOfUtcWeek(date)
        : utcDay(date);
  let cursor = startOfBucket(period.start);
  // All-time starts at a fixed epoch; a decade of empty months is noise.
  const guard = 400;
  while (cursor.getTime() < period.end.getTime() && buckets.length < guard) {
    buckets.push(cursor);
    cursor =
      period.granularity === "month"
        ? addUtcMonths(cursor, 1)
        : addUtcDays(cursor, period.granularity === "week" ? 7 : 1);
  }
  return buckets;
}

export function money(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

/** Compact form for axis labels and dense tiles: £1.2k, £950. */
export function moneyCompact(pence: number) {
  const pounds = pence / 100;
  if (Math.abs(pounds) >= 1000) {
    return `£${(pounds / 1000).toFixed(pounds % 1000 === 0 ? 0 : 1)}k`;
  }
  return `£${Math.round(pounds)}`;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatPercentChange(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function formatHours(hours: number) {
  if (hours === 0) return "0";
  return hours % 1 === 0 ? String(hours) : hours.toFixed(1);
}

export const customerGroupLabels: Record<string, string> = {
  parent_private: "Private",
  team_community: "Team / community",
  business: "Business",
};

/** The current filter as a query string, so links keep the period the user chose. */
export function periodSearch(
  period: ReportPeriod,
  extra: Record<string, string> = {}
) {
  const params = new URLSearchParams({ range: period.params.range });
  if (period.params.from) params.set("from", period.params.from);
  if (period.params.to) params.set("to", period.params.to);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return params.toString();
}

/**
 * Line up query results with every bucket in the period, so a month with no
 * income shows as a gap in the run rather than vanishing and pulling the months
 * either side of it together.
 */
export function alignToBuckets<T extends { bucket: string }>(
  period: ReportPeriod,
  results: T[]
): Array<{ date: Date; label: string; title: string; row: T | undefined }> {
  const byBucket = new Map(results.map((row) => [row.bucket, row]));
  return bucketRange(period).map((date) => ({
    date,
    label: bucketLabel(date, period.granularity),
    title:
      period.granularity === "month"
        ? formatMonth(date)
        : period.granularity === "week"
          ? `Week beginning ${formatDay(date)}`
          : formatDay(date),
    row: byBucket.get(toIsoDate(date)),
  }));
}
