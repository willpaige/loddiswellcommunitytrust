import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "@/components/admin/event-form";
import { createEvent } from "@/actions/events";
import { Button } from "@/components/ui/button";

export default function NewEventPage() {
  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/events">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Events
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-8">New Event</h1>
      <EventForm action={createEvent} />
    </div>
  );
}
