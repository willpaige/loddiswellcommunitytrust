import { createHmac, timingSafeEqual } from "node:crypto";

// Signed one-click unsubscribe links for raffle news. The token is an HMAC of
// the address, so a link can't be forged to unsubscribe someone else.

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

export function unsubscribeToken(email: string) {
  return createHmac("sha256", secret()).update(`raffle-news:${email.trim().toLowerCase()}`).digest("base64url");
}

export function verifyUnsubscribeToken(email: string, token: string) {
  const expected = Buffer.from(unsubscribeToken(email));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(email: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org";
  const e = encodeURIComponent(email.trim().toLowerCase());
  return `${appUrl}/raffles/unsubscribe?e=${e}&t=${unsubscribeToken(email)}`;
}
