import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LotteryDrawForm } from "@/components/admin/lottery-draw-form";
import { createDraw } from "@/actions/lottery-draws";

export default function NewLotteryDrawPage() {
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
      <h1 className="text-3xl font-bold mb-2">Add monthly draw</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Publish the winners of a monthly lottery draw.
      </p>

      <LotteryDrawForm action={createDraw} />
    </div>
  );
}
