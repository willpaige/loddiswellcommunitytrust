import { formatPence, formatRaffleSerial } from "@/lib/raffles/numbers";
import { formatUk } from "@/lib/raffles/time";

// Society lottery tickets must name the promoter, the society, the price and
// the draw date. {price} and {drawDate} are filled in from each raffle, so a
// duplicated raffle's small print never shows last month's details.
export const DEFAULT_RAFFLE_SMALL_PRINT =
  "Promoted by Zoë Crockford on behalf of Loddiswell Playing Fields & Village Hall Trust, The Village Hall, TQ7 4RH. Registered with South Hams District Council under the Gambling Act 2005, to raise funds for LPFVHT. Tickets {price} each. Draw {drawDate}.";

/**
 * The raffle number always appears: where the trustees' wording puts {serial},
 * or as "Raffle number R001." at the end when it doesn't, so custom small
 * print written before raffle numbers existed still carries one.
 */
export function renderSmallPrint(
  template: string | null | undefined,
  raffle: { ticketPricePence: number; drawAt: Date; serialNumber: number }
) {
  const serial = formatRaffleSerial(raffle.serialNumber);
  const text = template || DEFAULT_RAFFLE_SMALL_PRINT;
  const withSerial = text.includes("{serial}") ? text : `${text} Raffle number ${serial}.`;
  return withSerial
    .replaceAll("{serial}", serial)
    .replaceAll("{price}", formatPence(raffle.ticketPricePence))
    .replaceAll("{drawDate}", formatUk(raffle.drawAt, "d MMMM yyyy"));
}
