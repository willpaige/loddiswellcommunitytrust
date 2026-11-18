"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAsset } from "@/actions/uploads";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  onUpload?: (file: File) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  accept?: string;
  maxBytes?: number;
  contain?: boolean;
  folder?: string;
  helpText?: string;
  aspect?: "wide" | "square";
};

export function ImageUploadInput({
  value,
  onChange,
  onUpload,
  onBusyChange,
  accept = "image/*",
  maxBytes,
  contain,
  folder = "facilities",
  helpText,
  aspect = "wide",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick() {
    inputRef.current?.click();
  }

  async function handleFile(file: File) {
    setError(null);
    if (maxBytes && file.size > maxBytes) {
      setError(`Choose an image up to ${maxBytes / (1024 * 1024)} MB.`);
      return;
    }
    setUploading(true);
    onBusyChange?.(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", folder);
      const result = await uploadAsset(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onChange(result.url);
      await onUpload?.(file);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
    // Reset so picking the same file again still triggers onChange.
    e.target.value = "";
  }

  function remove() {
    setError(null);
    onChange(null);
  }

  const aspectClass = aspect === "square" ? "aspect-square" : "aspect-[3/2]";

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={onInputChange}
      />

      {value ? (
        <div className="space-y-3">
          <div
            className={`relative ${aspectClass} w-full max-w-md overflow-hidden rounded-lg border border-border bg-muted`}
          >
            <Image
              src={value}
              alt="Hero preview"
              fill
              sizes="(min-width: 768px) 28rem, 100vw"
              className={contain ? "object-contain" : "object-cover"}
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pick}
              disabled={uploading}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={remove}
              disabled={uploading}
              className="gap-1.5 text-muted-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className={`relative ${aspectClass} flex w-full max-w-md flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-copper-400 hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-6 w-6" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground">
                  Click to upload
                </span>{" "}
                an image
              </span>
              <span className="text-xs">PNG, JPG or WebP</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {helpText && !error && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
