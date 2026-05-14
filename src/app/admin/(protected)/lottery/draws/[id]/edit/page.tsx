import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LotteryDrawForm,
  type DrawResult,
} from "@/components/admin/lottery-draw-form";
import { SendDrawNotificationsButton } from "@/components/admin/send-draw-notifications-button";
import { getDraw, updateDraw } from "@/actions/lottery-draws";
import { db } from "@/lib/db";
import { lotteryTickets } from "@/lib/db/schema";

export default async function EditLotteryDrawPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draw = await getDraw(id);
  if (!draw) notFound();

  const update = updateDraw.bind(null, id);

  // Count unique active recipients for the confirmation dialog
  const activeSubs = await db
    .select({ email: lotteryTickets.email })
    .from(lotteryTickets)
    .where(eq(lotteryTickets.status, "active"));
  const recipientCount = new Set(
    activeSubs
      .map((r) => r.email.toLowerCase().trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  ).size;

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
      <h1 className="text-3xl font-bold mb-8">Edit draw</h1>

      <div className="space-y-8">
        <LotteryDrawForm
          action={update}
          initialData={{
            drawDate: draw.drawDate,
            results: (draw.results as DrawResult[]) ?? [],
            notes: draw.notes,
            published: draw.published,
          }}
        />

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Notify subscribers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send an email to every active subscriber with the winners and
              prizes for this draw.
            </p>
            <SendDrawNotificationsButton
              drawId={draw.id}
              recipientCount={recipientCount}
              notifiedAt={draw.notifiedAt}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
