import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/admin/event-form";
import { getEvent, getEventFacilityOptions, updateEvent } from "@/actions/events";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;
  const [event, facilities] = await Promise.all([
    getEvent(id),
    getEventFacilityOptions(),
  ]);

  if (!event) {
    notFound();
  }

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateEvent(id, formData);
  }

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/events">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Events
        </Link>
      </Button>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Edit Event</h1>
        {event.published && (
          <Button variant="outline" asChild>
            <Link href={`/admin/qr-codes?destination=event-${event.id}`}>Poster QR code</Link>
          </Button>
        )}
      </div>
      <EventForm action={handleUpdate} initialData={event} facilities={facilities} />
    </div>
  );
}
