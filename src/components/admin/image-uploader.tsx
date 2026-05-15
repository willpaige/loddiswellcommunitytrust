"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ImageUploaderProps {
  onImageUpload: (url: string) => void;
  currentImageUrl?: string;
  isLoading?: boolean;
}

export function ImageUploader({
  onImageUpload,
  currentImageUrl,
  isLoading = false,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Create form data for multipart upload
      const formData = new FormData();
      formData.set("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      const url = data.url;

      // Update preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Notify parent
      onImageUpload(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleRemoveImage() {
    setPreview(null);
    onImageUpload("");
    setError(null);
  }

  return (
    <div className="space-y-3">
      {!preview ? (
        <div className="relative">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading || isLoading}
            className="hidden"
            aria-label="Upload image"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isLoading}
          >
            {uploading || isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                Upload Image
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
            <img
              src={preview}
              alt="Preview"
              className="h-full w-full object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70"
              onClick={handleRemoveImage}
              disabled={uploading || isLoading}
              aria-label="Remove image"
            >
              <X className="h-4 w-4 text-white" aria-hidden="true" />
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isLoading}
          >
            {uploading || isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                Change Image
              </>
            )}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
