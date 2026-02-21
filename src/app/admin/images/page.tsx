"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ImageIcon, Upload, Loader2, Copy, Check } from "lucide-react";
import { getImages, uploadImage, deleteImage } from "@/actions/images";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ImageRecord = {
  id: string;
  url: string;
  altText: string;
  fileSize: number | null;
  createdAt: Date;
};

export default function AdminImagesPage() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadImages() {
    const imgs = await getImages();
    setImages(imgs);
    setLoading(false);
  }

  useEffect(() => {
    loadImages();
  }, []);

  async function handleUpload(formData: FormData) {
    setUploading(true);
    try {
      await uploadImage(formData);
      await loadImages();
      setDialogOpen(false);
    } catch {
      alert("Upload failed. Alt text is required for accessibility.");
    } finally {
      setUploading(false);
    }
  }

  function copyUrl(id: string, url: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Images</h1>
          <p className="mt-1 text-muted-foreground">
            Upload and manage photos. Copy URLs to use in events and pages.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload Image
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Image</DialogTitle>
              <DialogDescription>
                Upload a photo. Alt text is required for accessibility.
              </DialogDescription>
            </DialogHeader>
            <form action={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="altText">Alt Text *</Label>
                <Input
                  id="altText"
                  name="altText"
                  required
                  placeholder="Describe the image for screen readers"
                />
                <p className="text-xs text-muted-foreground">
                  E.g., &quot;Loddiswell Village Hall decorated for Christmas&quot;
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Image File *</Label>
                <Input
                  type="file"
                  id="file"
                  name="file"
                  required
                  accept="image/*"
                />
              </div>
              <Button type="submit" disabled={uploading} className="w-full">
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Uploading...
                  </>
                ) : (
                  "Upload"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {images.length === 0 ? (
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto">
              <ImageIcon className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle>No images yet</CardTitle>
            <CardDescription>Upload your first image to get started.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((img) => (
            <Card key={img.id} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                <Image
                  src={img.url}
                  alt={img.altText}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
              <div className="p-4">
                <p className="text-sm font-medium truncate">{img.altText}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyUrl(img.id, img.url)}
                    className="flex-1"
                  >
                    {copiedId === img.id ? (
                      <>
                        <Check className="h-3 w-3" aria-hidden="true" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        Copy URL
                      </>
                    )}
                  </Button>
                  <DeleteButton
                    id={img.id}
                    action={deleteImage}
                    label="Delete image"
                    description="This will permanently delete the image file."
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
