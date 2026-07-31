// Rules of the Loddiswell Community Lottery, a small society lottery
// registered with South Hams District Council under the Gambling Act 2005.
// These are the defaults: each section can be overridden in the CMS
// (Pages → Lottery Terms & Conditions), where section_1 maps to the first
// entry below, section_2 to the second, and so on.

export type LotteryTermsSection = {
  heading: string;
  paragraphs: string[];
};

export const LOTTERY_TERMS_VERSION = "July 2026";

export const LOTTERY_TERMS: LotteryTermsSection[] = [
  {
    heading: "The Promoter",
    paragraphs: [
      "The Loddiswell Community Lottery (“the Lottery”) is promoted by the Loddiswell Playing Fields and Village Hall Trust (“the Trust”) of The Village Hall, Loddiswell, TQ7 4RH. The Lottery is run as a small society lottery registered with South Hams District Council under the Gambling Act 2005.",
      "The person responsible for the promotion of the Lottery is Zoë Crockford, on behalf of the Trust. Questions about the Lottery should be sent to hello@loddiswellcommunitytrust.org.",
    ],
  },
  {
    heading: "Purpose",
    paragraphs: [
      "The Lottery is run to raise funds for the Trust. All proceeds, after prizes and any running costs, are used to maintain and improve Loddiswell’s community facilities — the Village Hall, Pavilion, Playing Fields, Tennis Courts and Play Park.",
    ],
  },
  {
    heading: "Who can take part",
    paragraphs: [
      "You must be aged 16 or over to buy a ticket or to be given a ticket. It is an offence to buy a lottery ticket on behalf of anyone under 16. The Trust may ask for proof of age at any time and will withhold any prize where age cannot be confirmed.",
      "Tickets may only be bought by people resident in the United Kingdom. Trustees, volunteers and their families may take part in the Lottery, but no person involved in conducting a draw may influence its outcome.",
    ],
  },
  {
    heading: "Tickets",
    paragraphs: [
      "Each ticket costs £12 and is entered into every monthly draw for twelve months from the date of purchase. There is no limit on the number of tickets one person may buy.",
      "Each ticket is allocated a ticket number, which is confirmed to you by email. Tickets are personal to the purchaser and may not be sold or transferred to anyone else. A ticket is only entered into a draw once payment has been received and cleared.",
    ],
  },
  {
    heading: "Payment and refunds",
    paragraphs: [
      "Payment is taken as a single, one-off payment for the year by card, through our payment provider Stripe. The Trust does not store your card details.",
      "Tickets are non-refundable once a draw in which they are entered has taken place. If you change your mind before your first draw, contact us and we will refund your payment in full. If a payment is taken in error, or a ticket cannot be entered for any reason, we will refund it.",
    ],
  },
  {
    heading: "The draw",
    paragraphs: [
      "A draw is held at the end of each month. Winning numbers are drawn at random from all tickets valid for that month, in the presence of at least two trustees.",
      "The number of prizes and the amount of each prize are set by the Trust for each draw and are announced with the results. Prizes are funded from ticket sales.",
    ],
  },
  {
    heading: "Winners and prizes",
    paragraphs: [
      "Winners are notified by email using the contact details supplied at the time of purchase, and results are published on this website and in the village newsletter. Winners’ names and ticket numbers may be published; if you would prefer your name not to be published, please tell us and we will publish your ticket number only.",
      "Prizes are paid by bank transfer or cheque within 28 days of the draw. It is your responsibility to keep your contact details up to date. Any prize that remains unclaimed three months after the draw will be treated as a donation to the Trust.",
    ],
  },
  {
    heading: "Your details",
    paragraphs: [
      "You can view and update your details, and see your ticket numbers, in your account on this website. Personal data is handled in accordance with our privacy policy and is never sold or passed to third parties for marketing.",
    ],
  },
  {
    heading: "Responsible gambling",
    paragraphs: [
      "The Lottery is intended as a way of supporting the village, not as a way of making money. Please only spend what you can comfortably afford.",
      "If you would like to be excluded from the Lottery, write to us and we will remove you from all future draws and will not accept further ticket purchases from you. Free, confidential advice and support is available from GamCare on 0808 8020 133 or at begambleaware.org.",
    ],
  },
  {
    heading: "Complaints and disputes",
    paragraphs: [
      "If you are unhappy with any aspect of the Lottery, please write to the Trust at hello@loddiswellcommunitytrust.org. We will acknowledge your complaint within seven days and give a full response within 28 days.",
      "If we cannot resolve matters between us, the dispute will be referred to South Hams District Council as our licensing authority. The decision of the trustees on the conduct of a draw is final, subject to that referral.",
    ],
  },
  {
    heading: "Liability",
    paragraphs: [
      "The Trust is not responsible for tickets, notifications or prizes that are delayed or lost because contact or payment details given to us are incorrect or out of date, or because of failures in postal, banking or email services outside our control.",
      "If a draw cannot be held on the intended date, it will be held as soon as reasonably possible afterwards. If the Lottery is discontinued, the Trust will refund the unused portion of any ticket.",
    ],
  },
  {
    heading: "Changes to these terms",
    paragraphs: [
      "The Trust may amend these terms from time to time, for example to reflect a change in the law or in how the Lottery is run. The current version is always published on this page, and by buying a ticket you accept the terms in force at that time.",
    ],
  },
];
