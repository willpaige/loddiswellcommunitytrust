import { describe, expect, it } from "vitest";
import { renderEmailHtml } from "@/lib/email/layout";
import { buttonLabelFor, decorate } from "@/lib/email/decor";

const appUrl = "https://example.test";

function render(key: Parameters<typeof decorate>[0], body: string, variables: Record<string, string>) {
  return renderEmailHtml({ body, variables, extras: decorate(key, variables, body), buttonLabel: buttonLabelFor(key), appUrl });
}

describe("email layout", () => {
  it("turns label/value lines into a details panel and a lone link into a labelled button", () => {
    const html = render(
      "manual_booking_payment_link",
      "Hi Sam,\n\nBooking: Court hire\nAmount due: £6\n\nhttps://pay.test/x?a=1&b=2",
      { paymentUrl: "https://pay.test/x?a=1&b=2", facilityName: "Tennis Courts", amount: "£6" }
    );
    expect(html).toContain('class="panel"');
    expect(html).toMatch(/Amount due<\/td>\s*<td[^>]*>£6/);
    expect(html).toContain(">Pay securely</a>");
    expect(html).toContain('href="https://pay.test/x?a=1&amp;b=2"');
    expect(html).not.toContain(">https://pay.test");
    expect(html).toContain("Payment needed");
  });

  it("adds a manage button the body leaves out, and ticket numbers as chips", () => {
    const html = render("lottery_welcome", "Hi Jo,\n\nTickets: 2\nTicket numbers: 12, 13", {
      ticketNumbers: "12, 13",
      manageUrl: "https://example.test/account/lottery",
    });
    expect(html).toContain(">Manage your tickets</a>");
    expect(html.match(/class="chip"/g)?.length).toBe(2);
    expect(html).not.toContain(">Ticket numbers<");
  });

  it("moves the unsubscribe paragraph to the footer as a short link", () => {
    const unsubscribeUrl = "https://example.test/raffles/unsubscribe?e=a&t=b";
    const html = render("raffle_on_sale", `Hello,\n\nDon't want raffle news? Unsubscribe: ${unsubscribeUrl}`, { unsubscribeUrl });
    expect(html).toContain(">Unsubscribe</a>");
    expect(html).not.toContain(`>${unsubscribeUrl}<`);
    expect(html.indexOf("Unsubscribe</a>")).toBeGreaterThan(html.indexOf("Questions? Just reply"));
  });

  it("renders winners as a ranked list and escapes customer text", () => {
    const html = render("lottery_draw_results", "Here are the results.\n\n1st: <b>Jo</b> ticket 12 — £50\n2nd: Sam ticket 40 — £25", { drawDate: "November 2026" });
    expect(html).toContain(">1st</div>");
    expect(html).toContain("&lt;b&gt;Jo&lt;/b&gt;");
    expect(html).toContain("November 2026 results");
  });

  it("gives access information an amber note", () => {
    const html = render("booking_confirmation", "Access information:\nGate code 4821", { facilityName: "Tennis Courts" });
    expect(html).toContain('class="note"');
    expect(html).toContain("Gate code 4821");
  });
});
