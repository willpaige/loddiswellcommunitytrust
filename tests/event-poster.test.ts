import { afterEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth }));

import { readEventPoster } from "@/actions/event-poster";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("keeps readable poster fields and rejects unsafe links and impossible dates", async () => {
  auth.mockResolvedValue({ user: { role: "editor" } });
  vi.stubEnv("OPENAI_API_KEY", "test");
  const fetchPoster = vi.fn().mockResolvedValue(Response.json({
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
      title: "Spring fair",
      description: "Bring cash for the cake stall.",
      location: "Loddiswell Village Hall",
      startDate: "2027-02-30T14:00",
      endDate: "2027-03-01T16:00",
      allDay: null,
      externalUrl: "javascript:alert(1)",
    }) }] }],
  }));
  vi.stubGlobal("fetch", fetchPoster);
  const data = new FormData();
  data.set("file", new File(["poster"], "poster.png", { type: "image/png" }));

  expect(await readEventPoster(data)).toEqual({ details: {
    title: "Spring fair",
    description: "Bring cash for the cake stall.",
    location: "Loddiswell Village Hall",
    startDate: null,
    endDate: null,
    allDay: null,
    externalUrl: null,
  } });
  const request = JSON.parse(fetchPoster.mock.calls[0][1].body);
  expect(request.store).toBe(false);
  expect(request.input[0].content[1].image_url).toMatch(/^data:image\/png;base64,/);

  auth.mockResolvedValue({ user: { role: "customer" } });
  expect(await readEventPoster(data)).toEqual({ error: "Unauthorized" });
  expect(fetchPoster).toHaveBeenCalledTimes(1);
});
