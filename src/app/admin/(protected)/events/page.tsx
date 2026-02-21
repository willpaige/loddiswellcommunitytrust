import Link from "next/link";
import { Plus, Pencil, Calendar } from "lucide-react";
import { getEvents, deleteEvent } from "@/actions/events";
import { format } from "date-fns";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminEventsPage() {
  const eventsList = await getEvents();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="mt-1 text-muted-foreground">
            Manage community events and calendar listings.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Event
          </Link>
        </Button>
      </div>

      {eventsList.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto">
              <Calendar
                className="h-12 w-12 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <CardTitle>No events yet</CardTitle>
            <CardDescription>
              Create your first event to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/events/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Event
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">
                  Location
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventsList.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.title}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {format(event.startDate, "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {event.location || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={event.published ? "default" : "secondary"}>
                      {event.published ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                        <Link
                          href={`/admin/events/${event.id}/edit`}
                          title="Edit event"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </Button>
                      <DeleteButton
                        id={event.id}
                        action={deleteEvent}
                        label="Delete event"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
