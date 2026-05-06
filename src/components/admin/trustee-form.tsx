"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImageUploadInput } from "@/components/admin/image-upload-input";

type Props = {
  action: (formData: FormData) => Promise<void>;
  initialData?: {
    name: string;
    role: string;
    bio: string | null;
    photoUrl: string | null;
    sortOrder: number;
    published: boolean;
  };
};

export function TrusteeForm({ action, initialData }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string>(
    initialData?.photoUrl || ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    formData.set("photoUrl", photoUrl);
    setLoading(true);
    try {
      await action(formData);
    } catch (e) {
      setLoading(false);
      throw e;
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Trustee details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={initialData?.name ?? ""}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Input
                id="role"
                name="role"
                required
                defaultValue={initialData?.role ?? ""}
                placeholder="Chair / Treasurer / Trustee"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio (optional)</Label>
            <Textarea
              id="bio"
              name="bio"
              rows={3}
              defaultValue={initialData?.bio ?? ""}
              placeholder="A short note about this trustee — interests, background, anything you’d like to share."
            />
          </div>

          <div className="space-y-2">
            <Label>Photo</Label>
            <ImageUploadInput
              value={photoUrl || null}
              onChange={(url) => setPhotoUrl(url ?? "")}
              folder="trustees"
              aspect="square"
              helpText="Optional. Square photos work best — they’ll be cropped to a circle."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sort order</Label>
            <Input
              type="number"
              id="sortOrder"
              name="sortOrder"
              defaultValue={initialData?.sortOrder ?? 0}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first. Use this to keep the chair at the top
              of the grid.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="published"
              name="published"
              defaultChecked={initialData?.published ?? true}
            />
            <Label htmlFor="published" className="font-normal">
              Published (visible on the About page)
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
          {initialData ? "Update trustee" : "Add trustee"}
        </Button>
      </div>
    </form>
  );
}
