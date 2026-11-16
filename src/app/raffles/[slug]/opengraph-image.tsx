import { ImageResponse } from "next/og";
import { getPublicRaffleBySlug } from "@/lib/raffles/public";
import { formatPence } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";

export const alt = "Loddiswell village raffle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BAND = 84;

const pill = { display: "flex", flexShrink: 0, whiteSpace: "nowrap", padding: "10px 22px", borderRadius: 10, fontSize: 30 } as const;

// The preview WhatsApp and Facebook show when a raffle link is shared, made
// from the raffle itself so nobody has to design a graphic each month.
export default async function RaffleShareImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  const title = raffle?.title ?? "Loddiswell village raffle";
  const price = raffle ? `${formatPence(raffle.ticketPricePence)} a ticket` : "";
  const draw = raffle ? `Draw ${formatUk(raffle.drawAt, "EEE d MMMM")}` : "";
  const cause = raffle?.causeTitle ? `For ${raffle.causeTitle}` : "For Loddiswell's community facilities";
  // The image renderer fetches the picture itself, so a site-relative path
  // (an image kept in /public) needs the full address.
  const hero = raffle?.heroImageUrl
    ? new URL(raffle.heroImageUrl, process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org").toString()
    : null;

  const pills = (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      {price && <div style={{ ...pill, background: "#B5654A", color: "white", fontWeight: 700 }}>{price}</div>}
      {draw && <div style={{ ...pill, border: "2px solid #9EAC8A" }}>{draw}</div>}
    </div>
  );

  // Raffle artwork is designed as a wide banner with the title written on it,
  // so it is shown whole across the card rather than cropped into a side
  // panel, with the price and draw date in a band underneath.
  if (hero) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#1F2619", color: "#F2F4EF" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt="" width={1200} height={630 - BAND} style={{ width: 1200, height: 630 - BAND, objectFit: "cover" }} />
          <div style={{ display: "flex", height: BAND, alignItems: "center", justifyContent: "space-between", padding: "0 32px" }}>
            {pills}
            <div style={{ display: "flex", fontSize: 24, color: "#C4CDB6", whiteSpace: "nowrap" }}>{cause}</div>
          </div>
        </div>
      ),
      size
    );
  }

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px", background: "#1F2619", color: "#F2F4EF" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#D49A7D", fontWeight: 700 }}>Loddiswell raffle</div>
          <div style={{ marginTop: 22, fontSize: title.length > 40 ? 64 : 80, lineHeight: 1.05, fontWeight: 800 }}>{title}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {pills}
          <div style={{ fontSize: 26, color: "#C4CDB6" }}>{cause}</div>
        </div>
      </div>
    ),
    size
  );
}
