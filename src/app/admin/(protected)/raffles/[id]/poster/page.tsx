import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getRaffleForAdmin } from "@/actions/raffles";
import { formatPence } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";
import { renderSmallPrint } from "@/lib/raffles/small-print";
import { PrintButton } from "@/components/admin/print-button";

export const dynamic = "force-dynamic";

// A4 poster for the shop, pub and noticeboards. It covers the admin chrome
// on screen and prints on its own.
export default async function RafflePosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raffle = await getRaffleForAdmin(id);
  if (!raffle) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://loddiswellcommunitytrust.org";
  const url = `${appUrl}/raffles/${raffle.slug}`;
  // Generated from our own URL, so it is safe to inline.
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#11150E", light: "#FFFFFF" } });
  const [first, ...others] = raffle.prizes;
  const displayUrl = url.replace(/^https?:\/\//, "");

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-muted print:static print:bg-white">
      <style>{`@page { size: A4; margin: 0 } @media print { body * { visibility: hidden } .raffle-poster, .raffle-poster * { visibility: visible } .raffle-poster { position: absolute; left: 0; top: 0 } }`}</style>
      <div className="mx-auto flex max-w-[210mm] justify-end gap-2 p-4 print:hidden">
        <PrintButton label="Print poster" />
      </div>
      <article className="raffle-poster mx-auto flex h-[297mm] w-[210mm] flex-col bg-white p-[14mm] text-sage-950 shadow-lg print:shadow-none">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-copper-700">Loddiswell village raffle</p>
        <h1 className="mt-3 font-serif text-[54px] leading-[1.02]">{raffle.title}</h1>
        {raffle.tagline && <p className="mt-3 text-xl leading-snug text-sage-800">{raffle.tagline}</p>}
        {raffle.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={raffle.heroImageUrl} alt="" className="mt-6 max-h-[110mm] w-full rounded-md object-contain" />
        )}
        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-md bg-copper-50 p-3">
            <p className="font-serif text-4xl">{formatPence(raffle.ticketPricePence)}</p>
            <p className="text-sm">a ticket</p>
          </div>
          <div className="rounded-md bg-copper-50 p-3">
            <p className="font-serif text-2xl leading-tight">{formatUk(raffle.drawAt, "EEE d MMM")}</p>
            <p className="text-sm">draw at {formatUk(raffle.drawAt, "h:mmaaa")}</p>
          </div>
          <div className="rounded-md bg-copper-50 p-3">
            <p className="font-serif text-2xl leading-tight">{raffle.maxTickets ? `${raffle.maxTickets}` : "Unlimited"}</p>
            <p className="text-sm">tickets</p>
          </div>
        </div>
        {(first || others.length > 0) && (
          <ul className="mt-5 space-y-1 text-lg">
            {first && <li><strong>1st prize:</strong> {first.title}{first.donatedBy ? ` (donated by ${first.donatedBy})` : ""}</li>}
            {others.map((p) => (
              <li key={p.rank}>
                <strong>{p.rank === 2 ? "2nd" : p.rank === 3 ? "3rd" : `${p.rank}th`}:</strong> {p.title}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-end gap-6 border-t-2 border-sage-900 pt-5">
          <div className="h-[42mm] w-[42mm] flex-shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="space-y-2">
            <p className="font-serif text-3xl leading-tight">Scan to buy tickets</p>
            <p className="text-lg font-semibold">{displayUrl}</p>
            <p className="text-base">
              All money raised goes to {raffle.causeTitle || "Loddiswell's community facilities"}. Tickets also available in person.
            </p>
            <p className="text-[9px] leading-snug text-sage-700">
              {renderSmallPrint(raffle.smallPrint, raffle)} {raffle.minAge}+ only. BeGambleAware.org
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
