"use client";

import { useState } from "react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface EventFormProps {
  action: (formData: FormData) => Promise<void>;
  initialData?: {
    title: string;
    description: string;
    location: string | null;
    startDate: Date;
    endDate: Date | null;
    allDay: boolean | null;
    imageUrl: string | null;
    published: boolean | null;
  };
}

export function EventForm({ action, initialData }: EventFormProps) {
  const [description, setDescription] = useState(
    initialData?.description || "{}"
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    formData.set("description", description);
    setLoading(true);
    try {
      await action(formData);
    } catch {
      setLoading(false);
    }
  }

  function formatDateForInput(date: Date | null | undefined) {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 16);
  }

  return (
    <form action={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
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
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                type="datetime-local"
                id="startDate"
                name="startDate"
                required
                defaultValue={formatDateForInput(initialData?.startDate)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
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
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              type="url"
              id="imageUrl"
              name="imageUrl"
              defaultValue={initialData?.imageUrl || ""}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              Upload images in the Images section first, then paste the URL here.
            </p>
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
          {initialData ? "Update Event" : "Create Event"}
        </Button>
      </div>
    </form>
  );
}
