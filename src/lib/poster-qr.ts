export const posterQrOptions = {
  margin: 4,
  errorCorrectionLevel: "M",
} as const;

export function publicPosterUrl(path: string) {
  return new URL(
    path,
    process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org"
  ).href;
}
