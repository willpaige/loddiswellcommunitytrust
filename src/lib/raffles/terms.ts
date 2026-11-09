// Standard rules for every Trust raffle. Raffles sold over several weeks,
// online and in person, are society lotteries under the Gambling Act 2005,
// so these follow the lottery terms closely. Each section can be overridden in
// the CMS (Pages → Raffle Terms & Conditions), section_1 for the first entry.
//
// Have a trustee and South Hams District Council confirm these before the
// first raffle launches.

import type { LotteryTermsSection } from "@/lib/lottery/terms";

export const RAFFLE_TERMS_VERSION = "November 2026";

export const RAFFLE_TERMS: LotteryTermsSection[] = [
  {
    heading: "The promoter",
    paragraphs: [
      "Each raffle (“the Raffle”) is promoted by the Loddiswell Playing Fields and Village Hall Trust (“the Trust”) of The Village Hall, Loddiswell, TQ7 4RH, as a small society lottery registered with South Hams District Council under the Gambling Act 2005.",
      "The person responsible for the promotion is Zoë Crockford, on behalf of the Trust. Questions should be sent to hello@loddiswellcommunitytrust.org.",
    ],
  },
  {
    heading: "Purpose",
    paragraphs: [
      "Raffles raise funds for the Trust. All proceeds, after prizes and running costs, go towards Loddiswell’s community facilities, and each raffle’s page says what it is raising money for.",
    ],
  },
  {
    heading: "Who can take part",
    paragraphs: [
      "You must be 16 or over to buy a ticket, or 18 or over for any raffle with a prize that includes alcohol; the raffle page shows which applies. It is an offence to buy a lottery ticket on behalf of anyone under 16. The Trust may ask for proof of age at any time and will withhold a prize where age cannot be confirmed.",
      "Tickets may only be bought by people resident in the United Kingdom. Trustees and volunteers may take part, but no one involved in conducting a draw may influence its outcome.",
    ],
  },
  {
    heading: "Tickets",
    paragraphs: [
      "Every ticket in a raffle costs the same, shown on the raffle page. Some raffles have a maximum number of tickets; once they have all been sold, no more are available.",
      "Each ticket has a number, confirmed to you by email (or on a paper slip for tickets bought in person). A ticket is entered only in the raffle it was bought for, and only once payment has been received. Tickets may not be resold.",
    ],
  },
  {
    heading: "Payment and refunds",
    paragraphs: [
      "Online payments are taken by card through our payment provider Stripe; the Trust does not store your card details. Tickets can also be bought in person with cash, cheque or bank transfer.",
      "Tickets can't be refunded once sales have closed. If a raffle is cancelled, every ticket is refunded in full. If a payment is taken in error, we will refund it.",
    ],
  },
  {
    heading: "The draw",
    paragraphs: [
      "The draw takes place on the date and time shown on the raffle page, after ticket sales have closed. Winning numbers are chosen at random from every valid ticket, either by our website’s secure random number generator or by drawing numbers by hand, in the presence of at least two trustees. Prizes are drawn in the order announced.",
      "Unless the raffle page says otherwise, each person can win only one prize per raffle. Every draw is recorded, including any redraw and the reason for it.",
    ],
  },
  {
    heading: "Winners and prizes",
    paragraphs: [
      "Winners are contacted by email or phone using the details given when the tickets were bought. Results are published on this website with the winning ticket numbers and each winner’s first name and initial; tell us if you would prefer only your ticket number to be shown.",
      "Each raffle page says how and by when prizes must be claimed. A prize not claimed by then may be redrawn. Prizes can’t be exchanged for cash. Prizes containing alcohol will only be handed to a winner who shows photo ID proving they are 18 or over.",
    ],
  },
  {
    heading: "Your details",
    paragraphs: [
      "We use your details to run the raffle: to send your ticket numbers, contact you if you win and send you the results. Unless you opt out when you buy, we may also tell you about future raffles. Personal data is handled in accordance with our privacy policy and is never sold.",
    ],
  },
  {
    heading: "Responsible gambling",
    paragraphs: [
      "Raffles are a way of supporting the village, not of making money. Please only spend what you can comfortably afford.",
      "If you would like to be excluded from our raffles and lottery, write to us and we will not accept further ticket purchases from you. Free, confidential advice is available from GamCare on 0808 8020 133 or at begambleaware.org.",
    ],
  },
  {
    heading: "Complaints and disputes",
    paragraphs: [
      "If you are unhappy with any aspect of a raffle, please write to hello@loddiswellcommunitytrust.org. We will acknowledge your complaint within seven days and respond in full within 28 days.",
      "If we cannot resolve matters between us, the dispute will be referred to South Hams District Council as our licensing authority. The trustees’ decision on the conduct of a draw is final, subject to that referral.",
    ],
  },
  {
    heading: "Changes to these terms",
    paragraphs: [
      "The Trust may amend these terms, for example to reflect a change in the law. The current version is always published on this page, and buying a ticket means accepting the terms in force at that time.",
    ],
  },
];
