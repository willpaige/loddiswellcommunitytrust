import { cn } from "@/lib/utils";
import { formatPercentChange, money, moneyCompact } from "@/lib/reports";

// Chart marks are plain HTML: a column is a div with a rounded data-end, a
// horizontal bar is a div in a track. Nothing here ships JavaScript, hover
// tooltips included, and every chart is followed by the same numbers as a table
// so the values are never gated behind colour or a pointer.

function niceCeiling(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  // Every step halves to a clean number, so the mid gridline never reads 12.5.
  const steps = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10];
  for (const step of steps) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

export function SeriesKey({
  items,
}: {
  items: Array<{ label: string; className: string }>;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-2.5 w-2.5 rounded-sm", item.className)} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function StatTile({
  label,
  value,
  hint,
  delta,
  deltaLabel,
  invertDelta = false,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  deltaLabel?: string;
  /** For figures where a rise is bad — refunds, cancellations, money owed. */
  invertDelta?: boolean;
  tone?: "default" | "attention";
}) {
  const showDelta = delta !== undefined;
  const direction = delta === null || delta === undefined ? 0 : Math.sign(delta);
  const good = invertDelta ? direction < 0 : direction > 0;
  const bad = invertDelta ? direction > 0 : direction < 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        tone === "attention" && "border-copper-300 bg-copper-50/60"
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
        {showDelta && (
          <span
            className={cn(
              "font-medium",
              good && "text-sage-600",
              bad && "text-copper-700",
              !good && !bad && "text-muted-foreground"
            )}
          >
            {formatPercentChange(delta ?? null)}
            {deltaLabel ? ` ${deltaLabel}` : ""}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

export type ColumnDatum = {
  label: string;
  /** Longer label for the hover card, e.g. the full month. */
  title?: string;
  segments: Array<{ key: string; label: string; value: number; className: string }>;
};

/**
 * Stacked columns over time. Segments are separated by a 2px gap in the surface
 * colour rather than a stroke, so touching series stay distinct without extra
 * ink on the chart.
 */
export function ColumnChart({
  data,
  format = money,
  axisFormat = moneyCompact,
  emptyMessage = "Nothing recorded in this period.",
  height = 180,
}: {
  data: ColumnDatum[];
  format?: (value: number) => string;
  /** Axis ticks are short by necessity — £1.2k where the tooltip says £1,234.00. */
  axisFormat?: (value: number) => string;
  emptyMessage?: string;
  height?: number;
}) {
  const totals = data.map((datum) =>
    datum.segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  );
  const peak = Math.max(...totals, 0);

  if (data.length === 0 || peak === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  const ceiling = niceCeiling(peak);
  // Enough columns and the labels collide; show every nth and let the hover card
  // and the table carry the rest.
  const labelEvery = Math.ceil(data.length / 12);

  return (
    <div>
      <div className="flex gap-3">
        <div
          className="flex w-12 flex-col justify-between text-right text-[11px] tabular-nums text-muted-foreground"
          style={{ height }}
          aria-hidden="true"
        >
          <span>{axisFormat(ceiling)}</span>
          <span>{axisFormat(ceiling / 2)}</span>
          <span>0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              <div className="border-t border-border" />
              <div className="border-t border-border" />
              <div className="border-t border-border" />
            </div>
            <ol className="relative flex h-full items-end gap-[3px]">
              {data.map((datum, index) => {
                const total = totals[index];
                return (
                  <li
                    key={`${datum.label}-${index}`}
                    className="group relative flex h-full flex-1 items-end justify-center"
                  >
                    <div
                      className="flex w-full max-w-[24px] flex-col-reverse justify-start gap-[2px] rounded-t-[4px] transition-opacity group-hover:opacity-80"
                      style={{ height: `${(total / ceiling) * 100}%` }}
                    >
                      {datum.segments
                        .filter((segment) => segment.value > 0)
                        .map((segment, segmentIndex, visible) => (
                          <div
                            key={segment.key}
                            className={cn(
                              segment.className,
                              segmentIndex === visible.length - 1 && "rounded-t-[4px]"
                            )}
                            style={{
                              height: `${(segment.value / total) * 100}%`,
                              minHeight: 2,
                            }}
                          />
                        ))}
                    </div>
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-left shadow-md group-hover:block">
                      <p className="text-xs font-medium text-foreground">
                        {datum.title ?? datum.label}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {datum.segments.map((segment) => (
                          <li
                            key={segment.key}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <span
                              className={cn("h-2 w-2 rounded-sm", segment.className)}
                              aria-hidden="true"
                            />
                            {segment.label}
                            <span className="ml-auto pl-3 tabular-nums text-foreground">
                              {format(segment.value)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {datum.segments.length > 1 && (
                        <p className="mt-1 border-t pt-1 text-xs font-medium tabular-nums text-foreground">
                          Total {format(total)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <ol className="mt-2 flex gap-[3px]" aria-hidden="true">
            {data.map((datum, index) => (
              <li
                key={`${datum.label}-label-${index}`}
                className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground"
              >
                {index % labelEvery === 0 ? datum.label : ""}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** Magnitude comparison across categories: one hue, length carries the value. */
export function BarList({
  items,
  format = money,
  emptyMessage = "Nothing to show yet.",
  barClassName = "bg-series-bookings",
}: {
  items: Array<{ key: string; label: string; sublabel?: string; value: number }>;
  format?: (value: number) => string;
  emptyMessage?: string;
  barClassName?: string;
}) {
  const peak = Math.max(...items.map((item) => item.value), 0);
  if (items.length === 0 || peak <= 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm text-foreground">
              {item.label}
              {item.sublabel && (
                <span className="ml-2 text-xs text-muted-foreground">{item.sublabel}</span>
              )}
            </p>
            <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
              {format(item.value)}
            </p>
          </div>
          <div className="mt-1 h-2 w-full rounded-sm bg-muted">
            <div
              className={cn("h-2 rounded-l-sm rounded-r-[4px]", barClassName)}
              style={{ width: `${Math.max(2, (item.value / peak) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A single ratio against its limit — hours used against hours available. */
export function Meter({
  value,
  label,
  caption,
}: {
  /** 0–100. */
  value: number | null;
  label: string;
  caption?: string;
}) {
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm text-foreground">{label}</p>
        <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
          {value === null ? "—" : `${clamped.toFixed(1)}%`}
        </p>
      </div>
      <div className="mt-1 h-2 w-full rounded-sm bg-muted">
        <div
          className="h-2 rounded-l-sm rounded-r-[4px] bg-series-bookings"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

/** The chart's numbers, for anyone who can't or would rather not read the marks. */
export function DataTable({
  columns,
  rows,
  caption,
}: {
  columns: string[];
  rows: Array<Array<string | number>>;
  caption?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        {caption ?? "View as table"}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              {columns.map((column, index) => (
                <th
                  key={column}
                  className={cn("py-1.5 pr-4 font-medium", index > 0 && "text-right")}
                  scope="col"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b last:border-0">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      "py-1.5 pr-4",
                      cellIndex > 0 && "text-right tabular-nums"
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
