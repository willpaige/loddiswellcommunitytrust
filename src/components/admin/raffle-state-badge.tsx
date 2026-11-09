import { Badge } from "@/components/ui/badge";
import type { RaffleState } from "@/lib/raffles/state";

const LABELS: Record<RaffleState, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-amber-100 text-amber-900 hover:bg-amber-100" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-900 hover:bg-red-100" },
  coming_soon: { label: "Scheduled", className: "bg-blue-100 text-blue-900 hover:bg-blue-100" },
  live: { label: "Live", className: "bg-green-100 text-green-900 hover:bg-green-100" },
  last_few: { label: "Live · last few", className: "bg-green-100 text-green-900 hover:bg-green-100" },
  sold_out: { label: "Sold out", className: "bg-green-100 text-green-900 hover:bg-green-100" },
  closed: { label: "Sales closed", className: "bg-orange-100 text-orange-900 hover:bg-orange-100" },
  drawn: { label: "Drawn", className: "bg-muted text-foreground hover:bg-muted" },
};

export function RaffleStateBadge({ state }: { state: RaffleState }) {
  const { label, className } = LABELS[state];
  return <Badge className={className}>{label}</Badge>;
}
