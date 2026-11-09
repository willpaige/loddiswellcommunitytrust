import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { RaffleForm } from "@/components/admin/raffle-form";
import { createRaffle } from "@/actions/raffles";
import { formatUk } from "@/lib/raffles/time";

export default function NewRafflePage() {
  // Starting dates, all editable: on sale tomorrow 9am, four weeks of sales
  // closing at 7pm, draw at 8pm. Built as UK wall-clock input values.
  const now = new Date();
  const day = (offset: number) => formatUk(addDays(now, offset), "yyyy-MM-dd");

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/raffles">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Raffles
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-8">New raffle</h1>
      <RaffleForm
        action={createRaffle}
        submitLabel="Create raffle"
        initial={{
          salesOpenAt: `${day(1)}T09:00`,
          salesCloseAt: `${day(29)}T19:00`,
          drawAt: `${day(29)}T20:00`,
        }}
      />
    </div>
  );
}
