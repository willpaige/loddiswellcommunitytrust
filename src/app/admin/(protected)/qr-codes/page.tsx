import { getUpcomingEvents } from "@/actions/events";
import { getRaffleList } from "@/actions/raffles";
import { PosterQrGenerator } from "@/components/admin/poster-qr-generator";
import { formatBookingDate } from "@/lib/booking-time";
import { publicPosterUrl } from "@/lib/poster-qr";

export default async function AdminQrCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string }>;
}) {
  const [{ destination }, events, raffles] = await Promise.all([
    searchParams,
    getUpcomingEvents(),
    getRaffleList(),
  ]);
  const destinations = [
    { id: "newsletter", label: "Email signup", url: publicPosterUrl("/#newsletter-signup") },
    { id: "lottery", label: "Village lottery", url: publicPosterUrl("/lottery") },
    ...events.map((event) => ({
      id: `event-${event.id}`,
      label: `${event.title} · ${formatBookingDate(event.startDate, "d MMM yyyy")}`,
      url: publicPosterUrl(`/events#event-${event.id}`),
    })),
    ...raffles.filter((raffle) => raffle.published).map((raffle) => ({
      id: `raffle-${raffle.id}`,
      label: `Raffle · ${raffle.title}`,
      url: publicPosterUrl(`/raffles/${raffle.slug}`),
    })),
  ];

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Poster QR codes</h1>
        <p className="mt-1 text-muted-foreground">Choose where the code should take people, then download it for your poster.</p>
      </div>
      <PosterQrGenerator key={destination} destinations={destinations} initialId={destination} />
    </div>
  );
}
