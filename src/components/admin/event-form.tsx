"use client";

import { useState } from "react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { ImageUploadInput } from "@/components/admin/image-upload-input";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface EventFormProps {
  action: (formData: FormData) => Promise<void>;
  facilities?: Array<{ id: string; name: string }>;
  initialData?: {
    title: string;
    description: string;
    location: string | null;
    startDate: Date;
    endDate: Date | null;
    allDay: boolean | null;
    imageUrl: string | null;
    externalUrl?: string | null;
    published: boolean | null;
    blockFacilityId?: string | null;
  };
}

export function EventForm({ action, facilities = [], initialData }: EventFormProps) {
  const [description, setDescription] = useState(
    initialData?.description || "{}"
  );
  const [imageUrl, setImageUrl] = useState<string>(
    initialData?.imageUrl || ""
  );
  const [recurringEvent, setRecurringEvent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    formData.set("description", description);
    formData.set("imageUrl", imageUrl);
    setLoading(true);
    try {
      await action(formData);
    } catch (e) {
      // Clear the spinner; re-throw so Next.js still processes redirects
      // and unexpected errors surface in the console.
      setLoading(false);
      throw e;
    }
  }

  function formatDateForInput(date: Date | null | undefined) {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 16);
  }

  function defaultMonthForInput() {
    const date = initialData?.startDate ? new Date(initialData.startDate) : new Date();
    return date.toISOString().slice(0, 7);
  }

  return (
    <form action={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event title *</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={initialData?.title}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <RichTextEditor content={description} onChange={setDescription} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date *</Label>
              <Input
                type="datetime-local"
                id="startDate"
                name="startDate"
                required={!recurringEvent}
                defaultValue={formatDateForInput(initialData?.startDate)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input
                type="datetime-local"
                id="endDate"
                name="endDate"
                defaultValue={formatDateForInput(initialData?.endDate)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              defaultValue={initialData?.location || ""}
              placeholder="e.g., Village Hall, Playing Fields"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="externalUrl">More info link</Label>
            <Input
              id="externalUrl"
              name="externalUrl"
              type="url"
              defaultValue={initialData?.externalUrl || ""}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Image</Label>
            <ImageUploadInput
              value={imageUrl || null}
              onChange={(url) => setImageUrl(url ?? "")}
              folder="events"
              helpText="Optional. Shown alongside the event on the public Events page."
            />
          </div>
        </CardContent>
      </Card>

      {!initialData && (
        <Card>
          <CardHeader>
            <CardTitle>Recurrence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="recurringEvent"
                name="recurringEvent"
                checked={recurringEvent}
                onCheckedChange={(checked) => setRecurringEvent(checked === true)}
              />
              <Label htmlFor="recurringEvent" className="font-normal">
                Create this as a recurring monthly event
              </Label>
            </div>

            {recurringEvent && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="weekOfMonth">Week of month</Label>
                  <select
                    id="weekOfMonth"
                    name="weekOfMonth"
                    defaultValue="2"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="1">First</option>
                    <option value="2">Second</option>
                    <option value="3">Third</option>
                    <option value="4">Fourth</option>
                    <option value="5">Fifth</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekday">Day</Label>
                  <select
                    id="weekday"
                    name="weekday"
                    defaultValue="4"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                    <option value="0">Sunday</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seriesStartTime">Start time</Label>
                  <Input id="seriesStartTime" name="seriesStartTime" type="time" defaultValue="14:00" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seriesEndTime">End time</Label>
                  <Input id="seriesEndTime" name="seriesEndTime" type="time" defaultValue="16:00" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seriesStartMonth">Start month</Label>
                  <Input id="seriesStartMonth" name="seriesStartMonth" type="month" defaultValue={defaultMonthForInput()} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthsAhead">Generate months ahead</Label>
                  <Input id="monthsAhead" name="monthsAhead" type="number" min="1" max="36" defaultValue="18" />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Exclude months</Label>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {[
                      ["1", "Jan"],
                      ["2", "Feb"],
                      ["3", "Mar"],
                      ["4", "Apr"],
                      ["5", "May"],
                      ["6", "Jun"],
                      ["7", "Jul"],
                      ["8", "Aug"],
                      ["9", "Sep"],
                      ["10", "Oct"],
                      ["11", "Nov"],
                      ["12", "Dec"],
                    ].map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="excludeMonths" value={value} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Booking availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="blockBookings"
              name="blockBookings"
              defaultChecked={Boolean(initialData?.blockFacilityId)}
            />
            <Label htmlFor="blockBookings" className="font-normal">
              Prevent bookings for a venue during this event
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blockFacilityId">Venue to block</Label>
            <select
              id="blockFacilityId"
              name="blockFacilityId"
              defaultValue={initialData?.blockFacilityId ?? ""}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose a venue</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="allDay"
              name="allDay"
              defaultChecked={initialData?.allDay ?? false}
            />
            <Label htmlFor="allDay" className="font-normal">
              All-day event
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="published"
              name="published"
              defaultChecked={initialData?.published ?? true}
            />
            <Label htmlFor="published" className="font-normal">
              Published (visible on the website)
            </Label>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {initialData ? "Update event" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
