"use server";

import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

export async function uploadAsset(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file provided" };
  }

  const folder = (formData.get("folder") as string) || "uploads";
  // Sanitise the filename and prepend a short suffix so re-uploads with the
  // same name don't collide.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const stamp = Math.random().toString(36).slice(2, 8);
  const path = `${folder}/${stamp}-${safeName}`;

  try {
    const blob = await put(path, file, { access: "public" });
    return { url: blob.url };
  } catch {
    return { error: "Upload failed. Please try again." };
  }
}
