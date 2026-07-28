"use client";

import { cn } from "@/lib/utils";

function timeOptions(startTime: string, endTime: string) {
  const startHour = Number(startTime.slice(0, 2));
  const endHour = Number(endTime.slice(0, 2));
  return Array.from({ length: Math.max(0, endHour - startHour + 1) }, (_, index) => {
    const hour = startHour + index;
    return `${hour.toString().padStart(2, "0")}:00`;
  });
}

export function AvailableTimePicker({
  name,
  value,
  onChange,
  availableTimes,
  startTime,
  endTime,
  disabled = false,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  availableTimes: string[];
  startTime: string;
  endTime: string;
  disabled?: boolean;
}) {
  const available = new Set(availableTimes);
  const options = timeOptions(startTime, endTime);

  return (
    <div>
      <input type="hidden" name={name} value={value} required />
      <div className="grid max-h-72 gap-2 overflow-y-auto rounded-lg border border-input bg-background p-2 shadow-sm">
        {options.map((option) => {
          const optionAvailable = available.has(option);
          const selected = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                if (optionAvailable) onChange(option);
              }}
              disabled={disabled || !optionAvailable}
              className={cn(
                "flex h-10 items-center justify-between rounded-md border px-3 text-sm transition",
                selected
                  ? "border-copper-600 bg-copper-600 text-white"
                  : "border-transparent bg-transparent",
                optionAvailable && !selected && "hover:border-copper-300 hover:bg-copper-50",
                !optionAvailable && "cursor-not-allowed text-muted-foreground/45"
              )}
              aria-pressed={selected}
            >
              <span>{option}</span>
              {!optionAvailable && <span className="text-xs">Unavailable</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
