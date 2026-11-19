import { Badge } from "@/components/ui/badge";
import type { LoadedLotteryReturn } from "@/lib/lottery/return/service";
import { formatUk } from "@/lib/raffles/time";

export function LotteryReturnStatus({ loaded }: { loaded: LoadedLotteryReturn }) {
  const { row, finished } = loaded;
  if (row.submittedAt) return <Badge>Submitted {formatUk(row.submittedAt, "d MMM yyyy")}</Badge>;
  if (row.emailedAt) return <Badge variant="secondary">Emailed {formatUk(row.emailedAt, "d MMM yyyy")}</Badge>;
  if (finished) return <Badge variant="destructive">Not sent yet</Badge>;
  return <Badge variant="outline">In progress · sends {formatUk(row.periodEnd, "d MMM yyyy")}</Badge>;
}
