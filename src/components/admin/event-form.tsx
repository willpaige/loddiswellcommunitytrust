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
  const [imageUrl, setImageUrl] = useState<string>(
    initialData?.imageUrl || ""
  );
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
                required
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
