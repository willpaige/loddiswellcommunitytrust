import { createHmac, timingSafeEqual } from "node:crypto";

// Private preview links for draft raffles. The token is an HMAC of the raffle
// id, so only someone given the link can see an unpublished raffle, and it
// can't be guessed from the slug. Publishing makes the normal URL work and
// the preview link keeps working too.

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

export function previewToken(raffleId: string) {
  return createHmac("sha256", secret()).update(`raffle-preview:${raffleId}`).digest("base64url").slice(0, 24);
}

export function verifyPreviewToken(raffleId: string, token: string | undefined | null) {
  if (!token) return false;
  const expected = Buffer.from(previewToken(raffleId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function previewUrl(raffle: { id: string; slug: string }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org";
  return `${appUrl}/raffles/${raffle.slug}?preview=${previewToken(raffle.id)}`;
}
