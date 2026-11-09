import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RaffleForm } from "@/components/admin/raffle-form";
import { getRaffleForAdmin, updateRaffle } from "@/actions/raffles";
import { dateToUkInput } from "@/lib/raffles/time";

export const dynamic = "force-dynamic";

export default async function EditRafflePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raffle = await getRaffleForAdmin(id);
  if (!raffle) notFound();

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href={`/admin/raffles/${id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to {raffle.title}
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-8">Edit raffle</h1>
      <RaffleForm
        action={updateRaffle.bind(null, id)}
        submitLabel="Save changes"
        ticketsSold={raffle.ticketsReserved + raffle.ticketsIssued}
        initial={{
          ...raffle,
          salesOpenAt: dateToUkInput(raffle.salesOpenAt),
          salesCloseAt: dateToUkInput(raffle.salesCloseAt),
          drawAt: dateToUkInput(raffle.drawAt),
        }}
      />
    </div>
  );
}
