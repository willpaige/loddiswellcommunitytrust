"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Expand, EyeOff, Eye, X } from "lucide-react";
import { Confetti } from "@/components/raffles/confetti";

export type RevealStep = { rank: number; prizeTitle: string; ticketNumber: number; name: string };

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

const SPIN_MS = 1400;
const LOCK_GAP_MS = 550;

/**
 * Plays back a draw that has already been saved. Nothing here picks a winner:
 * the digits spin for show and land on the recorded number.
 */
export function RaffleRevealScreen({
  raffleId,
  title,
  poolSize,
  raisedLabel,
  steps,
}: {
  raffleId: string;
  title: string;
  poolSize: number;
  raisedLabel: string;
  steps: RevealStep[];
}) {
  const [index, setIndex] = useState(-1); // -1: intro card
  const [digits, setDigits] = useState<string[]>(["0", "0", "0", "0"]);
  const [locked, setLocked] = useState(0);
  const [hideNames, setHideNames] = useState(false);
  const [done, setDone] = useState<number[]>([]);
  const timers = useRef<number[]>([]);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const current = index >= 0 ? steps[index] : null;
  const target = current ? String(current.ticketNumber).padStart(4, "0").split("") : [];
  const width = Math.max(4, target.length);
  const revealed = !!current && locked >= width;

  const play = useCallback(
    (i: number) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const step = steps[i];
      const final = String(step.ticketNumber).padStart(4, "0").split("");
      setIndex(i);
      if (reduced.current) {
        setDigits(final);
        setLocked(final.length);
        setDone((d) => [...new Set([...d, i])]);
        return;
      }
      setLocked(0);
      const spin = window.setInterval(() => {
        setDigits((prev) => prev.map(() => String(Math.floor(Math.random() * 10))));
      }, 60);
      timers.current.push(spin);
      final.forEach((_, d) => {
        timers.current.push(
          window.setTimeout(() => {
            setLocked(d + 1);
            if (d === final.length - 1) {
              clearInterval(spin);
              setDone((prev) => [...new Set([...prev, i])]);
            }
          }, SPIN_MS + d * LOCK_GAP_MS)
        );
      });
      // Keep spinning digits on screen, but show locked ones as final.
      setDigits(final.map(() => "0"));
    },
    [steps]
  );

  const next = useCallback(() => {
    if (index < steps.length - 1 && (index === -1 || revealed)) play(index + 1);
  }, [index, steps.length, revealed, play]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      }
      if (e.key.toLowerCase() === "f") document.documentElement.requestFullscreen?.().catch(() => {});
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next]);

  const shown = target.map((t, d) => (d < locked ? t : digits[d] ?? "0"));
  const finished = index === steps.length - 1 && revealed;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#141413] text-white">
      {finished && <Confetti pieces={120} />}
      <div className="flex items-center justify-between px-8 py-4 text-sm text-white/70">
        <span className="font-semibold uppercase tracking-[0.2em] text-copper-200">
          {title} · {poolSize} tickets
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setHideNames((h) => !h)} className="flex min-h-11 items-center gap-2 rounded-md border border-white/30 px-3 hover:bg-white/10">
            {hideNames ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
            {hideNames ? "Show names" : "Hide names"}
          </button>
          <button
            type="button"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            className="flex min-h-11 items-center gap-2 rounded-md border border-white/30 px-3 hover:bg-white/10"
          >
            <Expand className="h-4 w-4" aria-hidden="true" /> Full screen
          </button>
          <Link href={`/admin/raffles/${raffleId}/draw`} className="flex min-h-11 items-center gap-2 rounded-md border border-white/30 px-3 text-white no-underline hover:bg-white/10">
            <X className="h-4 w-4" aria-hidden="true" /> Close
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-10 px-8 pb-10 lg:flex-row">
        <main className="flex flex-1 flex-col items-center justify-center gap-8 text-center" aria-live="polite">
          {current ? (
            <>
              <h1 className="font-serif text-4xl sm:text-6xl">
                {ordinal(current.rank)} prize: {current.prizeTitle}
              </h1>
              <div className="flex gap-3 sm:gap-4" aria-label={revealed ? `Ticket ${target.join("")}` : "Drawing"}>
                {shown.map((d, i) => (
                  <span
                    key={i}
                    className={`flex h-32 w-24 items-center justify-center rounded-xl text-7xl font-extrabold tabular-nums sm:h-44 sm:w-32 sm:text-9xl ${
                      i < locked ? "bg-white text-[#141413]" : "bg-white/85 text-[#141413]/60"
                    }`}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <p className="min-h-12 text-4xl font-bold">{revealed && !hideNames ? current.name : revealed ? " " : "Drawing…"}</p>
              {revealed && index < steps.length - 1 && (
                <button type="button" onClick={next} className="min-h-14 rounded-md bg-copper-500 px-8 text-xl font-bold hover:bg-copper-600">
                  Next: {ordinal(steps[index + 1].rank)} prize →
                </button>
              )}
              {finished && (
                <Link href={`/admin/raffles/${raffleId}/draw`} className="min-h-14 rounded-md bg-copper-500 px-8 py-4 text-xl font-bold text-white no-underline hover:bg-copper-600">
                  Finish: confirm results
                </Link>
              )}
            </>
          ) : (
            <>
              <h1 className="font-serif text-5xl sm:text-7xl">{title}</h1>
              <p className="text-2xl text-white/80">
                {poolSize} tickets · {raisedLabel} raised
              </p>
              <button type="button" onClick={next} className="min-h-16 rounded-md bg-copper-500 px-10 text-2xl font-bold hover:bg-copper-600">
                Draw {steps[0] ? `the ${ordinal(steps[0].rank)} prize` : ""}
              </button>
              <p className="text-sm text-white/60">Space or → for the next prize · F for full screen</p>
            </>
          )}
        </main>

        <aside className="flex w-full flex-col justify-center gap-3 lg:w-80">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-white/60">Drawn so far</p>
          {steps.map((s, i) => (
            <div
              key={s.rank}
              className={`flex justify-between rounded-lg border px-4 py-3 text-lg ${done.includes(i) ? "border-copper-400" : "border-white/20 text-white/40"}`}
            >
              <span>
                {ordinal(s.rank)} · {s.prizeTitle}
              </span>
              <strong>{done.includes(i) ? `#${String(s.ticketNumber).padStart(4, "0")}` : "—"}</strong>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
