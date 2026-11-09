/** Ticket numbers are shown four digits wide: 247 → "0247". */
export function padTicket(n: number) {
  return String(n).padStart(4, "0");
}

export function formatTicket(n: number) {
  return `#${padTicket(n)}`;
}

/** [313, 314, 315, 320] → "0313–0315, 0320". */
export function compressRanges(numbers: number[]) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start: number | null = null;
  let prev: number | null = null;
  for (const n of sorted) {
    if (start === null) {
      start = prev = n;
    } else if (n === (prev ?? 0) + 1) {
      prev = n;
    } else {
      parts.push(start === prev ? padTicket(start) : `${padTicket(start)}–${padTicket(prev!)}`);
      start = prev = n;
    }
  }
  if (start !== null) parts.push(start === prev ? padTicket(start) : `${padTicket(start)}–${padTicket(prev!)}`);
  return parts.join(", ");
}

export function formatPence(pence: number) {
  return pence % 100 === 0 ? `£${(pence / 100).toFixed(0)}` : `£${(pence / 100).toFixed(2)}`;
}
