import { beforeAll, describe, expect, it } from "vitest";
import { previewToken, previewUrl, verifyPreviewToken } from "@/lib/raffles/preview";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret";
});

describe("raffle preview links", () => {
  it("accepts the token for its own raffle only", () => {
    const token = previewToken("raffle-a");
    expect(verifyPreviewToken("raffle-a", token)).toBe(true);
    expect(verifyPreviewToken("raffle-b", token)).toBe(false);
  });

  it("rejects missing, empty and tampered tokens", () => {
    const token = previewToken("raffle-a");
    expect(verifyPreviewToken("raffle-a", undefined)).toBe(false);
    expect(verifyPreviewToken("raffle-a", "")).toBe(false);
    expect(verifyPreviewToken("raffle-a", token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"))).toBe(false);
  });

  it("builds a link on the raffle's own slug", () => {
    expect(previewUrl({ id: "raffle-a", slug: "wheelbarrow" })).toMatch(/\/raffles\/wheelbarrow\?preview=[\w-]{24}$/);
  });
});
