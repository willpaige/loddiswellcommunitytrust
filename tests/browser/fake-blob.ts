export async function upload(pathname: string, file: File, options: { onUploadProgress: (event: { percentage: number }) => void }) {
  if (window.failNextUpload) { window.failNextUpload = false; throw new Error('offline'); }
  window.uploadedBytes = file.size; options.onUploadProgress({ percentage: 100 });
  return { url: `https://test.public.blob.vercel-storage.com/${pathname}` };
}
