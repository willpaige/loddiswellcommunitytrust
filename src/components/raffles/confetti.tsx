"use client";

import { useEffect, useState } from "react";

const COLOURS = ["#B5654A", "#D49A7D", "#5E7049", "#9EAC8A", "#E8C0AC"];

/**
 * A one-off burst of confetti, drawn with CSS only. Skipped entirely for
 * people who ask their system for reduced motion.
 */
export function Confetti({ pieces = 70 }: { pieces?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(id);
  }, []);
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <style>{`@keyframes raffle-confetti{0%{transform:translate3d(0,-10vh,0) rotate(0)}100%{transform:translate3d(var(--dx),110vh,0) rotate(var(--r))}}`}</style>
      {Array.from({ length: pieces }, (_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${(i * 37) % 100}%`,
            width: 8,
            height: 14,
            background: COLOURS[i % COLOURS.length],
            borderRadius: 2,
            animation: `raffle-confetti ${2.2 + ((i * 13) % 10) / 10}s ease-in ${((i * 7) % 10) / 20}s forwards`,
            ["--dx" as string]: `${((i * 53) % 40) - 20}vw`,
            ["--r" as string]: `${(i * 97) % 720}deg`,
          }}
        />
      ))}
    </div>
  );
}
