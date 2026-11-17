import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { renderInline, renderRichText, type TiptapJSON } from "@/lib/cms/render";
import parkImage from "../../../public/images/ride-n-slide/park-concept.jpg";
import logoImage from "../../../public/images/ride-n-slide/logo.png";

const RNS_URL = (process.env.RIDE_N_SLIDE_URL ?? "https://www.loddiswellridenslide.uk").replace(/\/$/, "");

type Funds = { target: number; raised: number; percent: number };

/** The live fundraising total from the Ride N Slide site, or null if it can't be read. */
async function getFunds(): Promise<Funds | null> {
  try {
    const res = await fetch(`${RNS_URL}/api/public/summary`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const { target, raised, percent } = data?.funds ?? {};
    if (![target, raised, percent].every((n) => typeof n === "number" && Number.isFinite(n)) || target <= 0) {
      return null;
    }
    return { target, raised, percent };
  } catch {
    return null;
  }
}

const pounds = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

const linkProps = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * Homepage section promoting Loddiswell Ride N Slide, the Trust and Parish
 * Council's park and pump track project. Every link opens the RNS site in a
 * new tab. The fund meter is hidden when the RNS summary can't be fetched.
 */
export async function RideNSlideBlock({ blocks }: { blocks: Record<string, TiptapJSON> }) {
  const funds = await getFunds();

  return (
    <section className="py-20 sm:py-24 bg-sage-100" aria-labelledby="home-rns-title">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:px-8">
        <a
          href={RNS_URL}
          {...linkProps}
          className="group relative block overflow-hidden rounded-lg bg-sage-200 no-underline"
          aria-label="Loddiswell Ride N Slide (opens in a new tab)"
        >
          <Image
            src={parkImage}
            alt="Concept image of the new park and pump track at the playing field, with a wooden play tower, picnic benches and riders on the track"
            placeholder="blur"
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="aspect-[16/10] h-auto w-full object-cover object-[center_60%] transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
          />
          <span className="absolute bottom-4 left-4 rounded-lg bg-white px-3 py-2 shadow-lg">
            <Image src={logoImage} alt="" sizes="140px" className="h-auto w-[120px] sm:w-[140px]" />
          </span>
        </a>

        <div className="min-w-0">
          <SectionLabel>{renderInline(blocks.rns_eyebrow, "A village project")}</SectionLabel>
          <h2 id="home-rns-title" className="font-serif text-3xl sm:text-4xl tracking-tight text-foreground">
            {renderInline(blocks.rns_title, "A new park and pump track for Loddiswell")}
          </h2>
          <div className="mt-5 max-w-xl space-y-3.5 text-sage-700 leading-relaxed">
            {renderRichText(
              blocks.rns_body,
              <>
                <p>
                  The Trust and Loddiswell Parish Council are raising money for Loddiswell Ride N Slide: a pump
                  track for bikes, scooters and skateboards, and a new play park, both on the playing field.
                </p>
                <p>It’s for everyone from toddlers to teenagers. The nearest pump track today is 14 miles away.</p>
              </>
            )}
          </div>

          {funds && (
            <div className="mt-7 rounded-lg bg-card px-5 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-serif text-3xl text-copper-600 tabular-nums">{pounds(funds.raised)}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  raised of {pounds(funds.target)} · {funds.percent}%
                </span>
              </div>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-sage-100"
                role="progressbar"
                aria-valuenow={funds.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Fundraising progress"
              >
                <div className="h-full rounded-full bg-copper-500" style={{ width: `${funds.percent}%` }} />
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={RNS_URL}
              {...linkProps}
              className="inline-flex items-center gap-2 rounded-sm bg-copper-500 px-6 py-3 text-sm font-medium tracking-wide text-white no-underline hover:bg-copper-600 transition-colors"
            >
              Visit Ride N Slide
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <a
              href={`${RNS_URL}/get-involved`}
              {...linkProps}
              className="inline-flex items-center gap-2 rounded-sm border border-sage-200 bg-card px-6 py-3 text-sm font-medium tracking-wide text-sage-800 no-underline hover:border-copper-400 transition-colors"
            >
              How you can help
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
