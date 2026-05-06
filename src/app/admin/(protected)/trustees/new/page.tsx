import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrusteeForm } from "@/components/admin/trustee-form";
import { createTrustee } from "@/actions/trustees";

export default function NewTrusteePage() {
  return (
    <div>
      <Button
        variant="link"
        asChild
        className="mb-6 px-0 text-muted-foreground"
      >
        <Link href="/admin/trustees">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Trustees
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-2">Add trustee</h1>
      <p className="text-sm text-muted-foreground mb-8">
        New trustees appear in the committee grid on the About page.
      </p>

      <TrusteeForm action={createTrustee} />
    </div>
  );
}
