import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualSubscriberForm } from "@/components/admin/manual-subscriber-form";
import { createManualSubscriber } from "@/actions/lottery-admin";

export default function NewManualSubscriberPage() {
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
      <h1 className="text-3xl font-bold mb-2">Add manual subscriber</h1>
      <p className="text-sm text-muted-foreground mb-8">
        For subscribers paying outside Stripe (cheque, cash, standing order).
      </p>

      <ManualSubscriberForm action={createManualSubscriber} />
    </div>
  );
}
