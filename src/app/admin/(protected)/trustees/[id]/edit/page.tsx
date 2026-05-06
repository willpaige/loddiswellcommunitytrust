import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrusteeForm } from "@/components/admin/trustee-form";
import { getTrustee, updateTrustee } from "@/actions/trustees";

export default async function EditTrusteePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trustee = await getTrustee(id);
  if (!trustee) notFound();

  const update = updateTrustee.bind(null, id);

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
      <h1 className="text-3xl font-bold mb-8">Edit: {trustee.name}</h1>

      <TrusteeForm
        action={update}
        initialData={{
          name: trustee.name,
          role: trustee.role,
          bio: trustee.bio,
          photoUrl: trustee.photoUrl,
          sortOrder: trustee.sortOrder,
          published: trustee.published,
        }}
      />
    </div>
  );
}
