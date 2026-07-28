export const LOTTERY_LAUNCH_DATE = new Date("2026-07-31T23:00:00.000Z");

export function isLotteryLive(now = new Date()) {
  return now >= LOTTERY_LAUNCH_DATE;
}
