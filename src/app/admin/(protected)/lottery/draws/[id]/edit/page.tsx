import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LotteryDrawForm,
  type DrawResult,
} from "@/components/admin/lottery-draw-form";
import { getDraw, updateDraw } from "@/actions/lottery-draws";

export default async function EditLotteryDrawPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draw = await getDraw(id);
  if (!draw) notFound();

  const update = updateDraw.bind(null, id);

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

      <LotteryDrawForm
        action={update}
        initialData={{
          drawDate: draw.drawDate,
          results: (draw.results as DrawResult[]) ?? [],
          notes: draw.notes,
          published: draw.published,
        }}
      />
    </div>
  );
}
