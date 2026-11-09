"use client";

import { useEffect, useState } from "react";

type Activity = { sold: number; recent: { quantity: number; at: string }[] };

function ago(iso: string, now: number) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/**
 * "Someone just bought 5 tickets · 4 min ago". Polls every 30 seconds and
 * cycles through the last few purchases. Shows nothing if it's been quiet.
 */
export function ActivityTicker({ raffleId }: { raffleId: string }) {
  const [data, setData] = useState<Activity | null>(null);
  const [i, setI] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/raffles/${raffleId}/activity`);
        if (res.ok && alive) setData(await res.json());
      } catch {
        // A missed poll just keeps the last message.
      }
    }
    load();
    const poll = setInterval(load, 30_000);
    const rotate = setInterval(() => {
      setI((n) => n + 1);
      setNow(Date.now());
    }, 6_000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(rotate);
    };
  }, [raffleId]);

  const recent = data?.recent ?? [];
  if (recent.length === 0) return null;
  const item = recent[i % recent.length];

  return (
    <div className="flex items-center gap-3 rounded-md bg-muted px-3 py-2.5 text-sm" aria-live="polite">
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage-500 opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sage-600" />
      </span>
      <span>
        Someone bought {item.quantity} ticket{item.quantity === 1 ? "" : "s"} · {ago(item.at, now)}
      </span>
    </div>
  );
}
