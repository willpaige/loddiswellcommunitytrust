import { TZDate } from "@date-fns/tz";

export const REQUIREMENT_UPLOAD_LIMIT = 10 * 1024 * 1024;
export const REQUIREMENT_UPLOAD_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const HOUR = 60 * 60 * 1000;

// Booking timestamps contain UK wall-clock values in their UTC fields.
export function requirementNow(realNow = new Date()) {
  const uk = new TZDate(realNow, "Europe/London");
  return new Date(Date.UTC(uk.getFullYear(), uk.getMonth(), uk.getDate(), uk.getHours(), uk.getMinutes(), uk.getSeconds()));
}

export function requirementDeadline(start: Date, now = requirementNow()) {
  const deadline = new Date(start.getTime() - 48 * HOUR);
  return { deadline, overdue: deadline <= now };
}

export function requirementStage(start: Date, now = requirementNow()) {
  const hours = (start.getTime() - now.getTime()) / HOUR;
  if (hours <= 0) return null;
  if (hours <= 48) return "48h";
  if (hours <= 7 * 24) return "7d";
  if (hours <= 14 * 24) return "14d";
  return "initial";
}

export function requirementRetryAt(attempts: number, now = new Date()) {
  return new Date(now.getTime() + Math.min(24, 2 ** Math.min(attempts - 1, 5)) * HOUR);
}

export function requirementAnswerCurrent(
  question: { updatedAt?: Date },
  response?: { updatedAt?: Date } | null,
) {
  return Boolean(response && (!question.updatedAt || !response.updatedAt || response.updatedAt >= question.updatedAt));
}
