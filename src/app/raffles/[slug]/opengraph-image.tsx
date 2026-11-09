import { ImageResponse } from "next/og";
import { getPublicRaffleBySlug } from "@/lib/raffles/public";
import { formatPence } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";

export const alt = "Loddiswell village raffle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The preview WhatsApp and Facebook show when a raffle link is shared, made
// from the raffle itself so nobody has to design a graphic each month.
export default async function RaffleShareImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  const title = raffle?.title ?? "Loddiswell village raffle";
  const price = raffle ? `${formatPence(raffle.ticketPricePence)} a ticket` : "";
  const draw = raffle ? `Draw ${formatUk(raffle.drawAt, "EEE d MMMM")}` : "";
  const cause = raffle?.causeTitle ? `For ${raffle.causeTitle}` : "For Loddiswell's community facilities";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#1F2619", color: "#F2F4EF" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px", width: raffle?.heroImageUrl ? "56%" : "100%" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#D49A7D", fontWeight: 700 }}>Loddiswell raffle</div>
            <div style={{ marginTop: 22, fontSize: title.length > 40 ? 58 : 72, lineHeight: 1.05, fontWeight: 800 }}>{title}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 16 }}>
              {price && <div style={{ display: "flex", background: "#B5654A", color: "white", padding: "12px 22px", borderRadius: 10, fontSize: 32, fontWeight: 700 }}>{price}</div>}
              {draw && <div style={{ display: "flex", border: "2px solid #9EAC8A", padding: "12px 22px", borderRadius: 10, fontSize: 32 }}>{draw}</div>}
            </div>
            <div style={{ fontSize: 26, color: "#C4CDB6" }}>{cause}</div>
          </div>
        </div>
        {raffle?.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={raffle.heroImageUrl} alt="" width={528} height={630} style={{ width: "44%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
    ),
    size
  );
}
