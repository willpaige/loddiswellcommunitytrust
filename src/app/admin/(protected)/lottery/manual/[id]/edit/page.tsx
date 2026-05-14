import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq, and } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ManualSubscriberForm } from "@/components/admin/manual-subscriber-form";
import { updateManualSubscriber } from "@/actions/lottery-admin";
import { db } from "@/lib/db";
import { lotteryTickets } from "@/lib/db/schema";

export default async function EditManualSubscriberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(lotteryTickets)
    .where(
      and(
        eq(lotteryTickets.id, id),
        eq(lotteryTickets.source, "manual")
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) notFound();

  const update = updateManualSubscriber.bind(null, id);

  return (
    <div>
      <Button
        variant="link"
        asChild
        className="mb-6 px-0 text-muted-foreground"
      >
        <Link href="/admin/lottery">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Lottery
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-8">Edit: {row.name}</h1>

      <ManualSubscriberForm
        action={update}
        initialData={{
          name: row.name,
          email: row.email,
          phone: row.phone,
          quantity: row.quantity,
          notes: row.notes,
          expiryDate: row.expiryDate,
        }}
      />
    </div>
  );
}
