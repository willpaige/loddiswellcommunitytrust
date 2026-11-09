import { formatPence } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";

// Society lottery tickets must name the promoter, the society, the price and
// the draw date. {price} and {drawDate} are filled in from each raffle, so a
// duplicated raffle's small print never shows last month's details.
export const DEFAULT_RAFFLE_SMALL_PRINT =
  "Promoted by Zoë Crockford on behalf of Loddiswell Playing Fields & Village Hall Trust, The Village Hall, TQ7 4RH. Registered with South Hams District Council under the Gambling Act 2005, to raise funds for LPFVHT. Tickets {price} each. Draw {drawDate}.";

export function renderSmallPrint(
  template: string | null | undefined,
  raffle: { ticketPricePence: number; drawAt: Date }
) {
  return (template || DEFAULT_RAFFLE_SMALL_PRINT)
    .replaceAll("{price}", formatPence(raffle.ticketPricePence))
    .replaceAll("{drawDate}", formatUk(raffle.drawAt, "d MMMM yyyy"));
}
