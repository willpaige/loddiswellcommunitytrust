import { notFound } from "next/navigation";
import { isLotteryLive } from "@/lib/lottery-launch";

export const dynamic = "force-dynamic";

export default function LotteryLayout({ children }: { children: React.ReactNode }) {
  if (!isLotteryLive()) notFound();
  return children;
}
