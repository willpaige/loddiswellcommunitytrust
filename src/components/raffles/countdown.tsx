"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * Ticks down to `target`. When it reaches zero the page refreshes, so the
 * server can move the raffle to its next state (sales open, sales closed).
 */
export function Countdown({
  target,
  label,
  tone = "light",
}: {
  target: string;
  label: string;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const end = new Date(target).getTime();
  // Rendered on the server as the full span; the client takes over on mount.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= end) {
        clearInterval(id);
        setTimeout(() => router.refresh(), 1500);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [end, router]);

  const { days, hours, minutes, seconds } = parts(end - (now ?? end - 0));
  const units = [
    { value: days, label: days === 1 ? "day" : "days" },
    { value: hours, label: "hrs" },
    { value: minutes, label: "mins" },
    { value: seconds, label: "secs" },
  ];
  const muted = tone === "dark" ? "text-sage-200" : "text-muted-foreground";

  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>{label}</p>
      <div
        className="mt-2 grid grid-cols-4 gap-2 text-center"
        role="timer"
        aria-live="off"
        aria-label={`${label}: ${days} days, ${hours} hours, ${minutes} minutes`}
      >
        {units.map((u) => (
          <div key={u.label}>
            <div className="font-serif text-3xl sm:text-4xl tabular-nums">
              {now === null ? "–" : String(u.value).padStart(2, "0")}
            </div>
            <div className={`text-xs ${muted}`}>{u.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
