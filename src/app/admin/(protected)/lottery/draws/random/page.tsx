import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RandomDrawForm } from "@/components/admin/random-draw-form";

export default function RandomDrawPage() {
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
      <h1 className="text-3xl font-bold mb-2">Random draw</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Pick winners at random from active subscribers, weighted by ticket
        quantity. Winners are unique by email — nobody wins two prizes in the
        same draw.
      </p>

      <RandomDrawForm />
    </div>
  );
}
