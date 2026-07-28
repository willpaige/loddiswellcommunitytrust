// Terms and Conditions of Hire for the Loddiswell Playing Fields and Village
// Hall Trust (Pavilion & Village Hall), amended January 2026.
// Source: 2026 Pavilion & VH Terms & Conditions of hire V3.

export type TermsSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export const TERMS_VERSION = "January 2026";

export const TERMS_INTRO =
  "If the Hirer is in any doubt as to the meaning of any of these conditions, the Booking Secretary should be contacted immediately.";

export const BOOKING_TERMS: TermsSection[] = [
  {
    heading: "Responsibility of Hirer and minimum age",
    paragraphs: [
      "The hirer not being a person under 18 years of age, hereby accepts responsibility for being in charge of and on the premises at all times when the public are present and for ensuring that all conditions under this agreement relating to management and supervision of the premises are met.",
    ],
  },
  {
    heading: "Supervision",
    paragraphs: ["The Hirer shall, during the period of hiring be responsible for –"],
    bullets: [
      "supervision of the premises, the fabric and the contents; their care and safety from damage however slight or change of any sort.",
      "the behaviour of all persons using the premises, whatever their capacity, both within the premises and their immediate vicinity.",
      "proper supervision of carparking arrangements so as to avoid obstruction of the vehicular entrance.",
    ],
  },
  {
    heading: "",
    paragraphs: [
      "As directed by the Booking Secretary, the Hirer shall make good or pay for all damage (including accidental damage) to the premises or to the fixtures, fittings, or contents and for the loss of contents. At the discretion of Trust, a returnable deposit may be required (see also clause 27 – No Alterations).",
    ],
  },
  {
    heading: "Use of premises",
    paragraphs: [
      "The Hirer shall not use the premises for any purpose other than that described in the Hiring Agreement and shall not sub-hire or use the premises or allow the premises to be used for any unlawful way nor to do anything or bring onto the premises anything which may endanger the same or render invalid any insurance policies in respect thereof nor allow the consumption of alcohol thereon without prior permission. Hire charges and, if applicable, any special conditions, will be notified to the Hirer and agreed with the Booking Secretary in advance of the hiring.",
    ],
  },
  {
    heading: "Sale of alcohol or supply of alcohol",
    bullets: [
      "The Pavilion bar facilities will be operated exclusively by the Loddiswell Community Pub Group (LCPG) and its trained staff. Where alcohol is to be made available at an event, hirers are expected to use this bar service.",
      "Hirers are not permitted to sell or supply alcohol themselves. The sale of alcohol by a hirer, whether through a cash bar, ticketing, or other means, is strictly prohibited unless: the hirer has first obtained written consent from the Committee; and the hirer has applied for and been granted a Temporary Event Notice (TEN) from the local licensing authority, and provides a copy of the TEN to the Booking Secretary at least 21 days before the event.",
      "The Committee reserves the right to refuse consent for hirers to sell alcohol and to require that all alcohol provision be made solely through the LCPG bar service.",
    ],
  },
  {
    heading: "Music performance and dangerous and unsuitable performances – Premises licence",
    paragraphs: [
      "The Hirer shall obtain a Public Performing Licence/Performing Rights Licence for the performance of live and/or the playing recorded music. The Hirer shall ensure that any performance of music ceases at the time specified by the Premises Licence for the Village Hall, which is displayed on the notice board. A breach of the Premises Licence may lead to prosecution by the Local Authority. Performances involving danger to the public or of a sexually explicit nature shall not be given.",
    ],
  },
  {
    heading: "Maximum permitted number of people",
    paragraphs: [
      "The Hirer agrees not to exceed the maximum permitted number of people including helpers, entertainers and bands as set out in the Premises Licence.",
    ],
    bullets: ["200 for the Village Hall", "120 for the Pavilion"],
  },
  {
    heading: "Attendance",
    paragraphs: [
      "The Hirer agrees to be present throughout the entire period of hiring and to comply fully with this Hire Agreement.",
    ],
  },
  {
    heading: "Hire rates and payment terms",
    paragraphs: [
      "Payment to be made when the premises are booked. The times booked should be adhered to at all times or further charges will be applied.",
    ],
  },
  {
    heading: "Insurance and indemnity",
    paragraphs: ["The Hirer shall be liable for:"],
    bullets: [
      "the cost of repair of any damage (including accidental and malicious damage) done to part of the premises including the curtilages thereof or the contents of the premises;",
      "all claims, losses, damages, and costs made against or incurred by the Trust, volunteers, agents, or invitees in respect of damage or loss of property or injury to persons arising as a result of the use of the premises (including the storage of equipment) by the Hirer; and",
      "all claims, losses, damages and costs made against or incurred by the Trust, volunteers, agents or invitees as a result of any nuisance caused by a third party as a result of the use of the premises by the Hirer; and subject to clause (b) below, the Hirer shall indemnify and keep indemnified accordingly each member of the Trust and the employees, volunteers, agents and invitees against such liabilities.",
    ],
  },
  {
    heading: "",
    paragraphs: [
      "The Trust shall take out adequate insurance to insure liabilities described in sub-clause (a)(i) above and, in the case of non-commercial hirers, insure the liabilities described in sub-clause (a)(ii) and (iii) above. The Trust shall claim on its insurance for any liability of the Hirer hereunder, but the Hirer shall indemnify and keep indemnified each member of the Trust and its employees, volunteers, agents and invitees against (i) any insurance excess incurred and (ii) the difference between the amount of the liability and the monies received under the insurance policy.",
      "Where the Trust does not insure the liabilities described in sub-clauses (a)(ii) and (iii) above, the Hirer shall take out adequate insurance to insure such liability and on demand shall produce the policy and current receipt or other evidence of cover to the Booking Secretary. Failure to produce such policy and evidence of cover will render the hiring void and enable the Booking Secretary to rehire the premises to another Hirer.",
      "The Village Hall is insured against any claims arising out of its own negligence.",
    ],
  },
  {
    heading: "Gaming, betting, and lotteries",
    paragraphs: [
      "The Hirer shall ensure that nothing is done on or in relation to the premises in contravention of the law relating to gaming, betting, and lotteries.",
    ],
  },
  {
    heading: "Public safety compliance",
    paragraphs: [
      "The Hirer is responsible for fire safety for the duration of the hire and shall comply with all conditions and regulations made in respect of the premises by the Local Authority, the Licensing Authority, and the premises Fire Risk Assessment or otherwise, particularly in connection with any event which constitutes regulated entertainment, at which alcohol is sold or provided, or which is attended by children. The hirer shall also comply with the premises health and safety policy.",
      "The Hirer shall familiarise themselves with:",
    ],
    bullets: [
      "The action to be taken in the event of a fire. This includes calling the Fire Service and evacuating the premises.",
      "The location and use of fire equipment.",
      "Escape routes and the need to keep them clear.",
      "Method of operation of escape door fastenings.",
      "Location of the first aid box.",
      "The emergency lighting supply illuminating all exit signs and routes is operated by an automatic mains failure switching device.",
    ],
  },
  {
    heading: "",
    paragraphs: ["In advance of the event the Hirer shall check the following items:"],
    bullets: [
      "All escape routes are free from obstruction and can be freely used.",
      "Firefighting equipment is unobstructed and ready for use.",
      "There are no obvious fire hazards on the premises.",
    ],
  },
  {
    heading: "",
    paragraphs: [
      "The Fire Service shall be called to any outbreak of fire, however slight, and details shall be given to the Booking Secretary. No-one should re-enter the premises until a Fire Officer has given all clear.",
    ],
  },
  {
    heading: "Smoking, illegal drugs and disorderly behaviour",
    paragraphs: [
      "The Hirer shall, and shall ensure that the Hirer's invitees, comply with the prohibition of smoking in public places provisions of the Health Act 2006 and regulations made thereunder. Any person who breaches this provision shall be asked to leave the premises.",
      "No illegal drugs may be brought onto or used by any person within the premises or the near vicinity. Any person suspected of being under the influence of drugs or who is behaving in a violent or disorderly way shall be asked to leave the premises.",
    ],
  },
  {
    heading: "Noise",
    paragraphs: [
      "The Hirer shall ensure that, in order to avoid disturbing the neighbours in the near vicinity, the minimum of noise is made on arrival and departure, particularly at night. All activity must end by 11pm on the day of hiring unless otherwise agreed in writing with the Trust. The Hirer must comply with any other licensing condition of the premises.",
    ],
  },
  {
    heading: "Health and hygiene",
    paragraphs: [
      "The Hirer shall, if preparing, serving, or selling food, observe all relevant food health and hygiene legislation and regulations. The premises are provided with a refrigerator.",
    ],
  },
  {
    heading: "Electrical appliance safety",
    paragraphs: [
      "The Hirer shall ensure that any electrical appliances brought by them onto the premises and used there shall be safe, in good working order, and used in accordance with the Electricity at Work Regulations 1989 and is removed at the end of the hire. The Hirer will not alter or interfere with any electrical system on the premises.",
    ],
  },
  {
    heading: "Compliance with legislation relating to children and vulnerable adults",
    paragraphs: [
      "The Hirer shall ensure that any activities for children, young people and other vulnerable adults are only provided by fit and proper persons in accordance with the Childrens Acts 1989 and 2004, Safeguarding Vulnerable Groups Act 2006 and any subsequent legislation. When requested, the Hirer shall provide a copy of their Safeguarding Policy and evidence that relevant checks through the Disclosure and Barring Service (DBS) has been conducted. Private parties arranged for invited friends and family events are exempt from this requirement. All reasonable steps must be taken to prevent harm and to respond appropriately when harm does occur. Relevant concerns must be reported.",
    ],
  },
  {
    heading: "Stored equipment",
    paragraphs: [
      "The Trust accepts no responsibility for any equipment permitted to be stored on the premises, or for any other equipment brought on to or left on the premises, and all liability for loss or damage is hereby excluded. All equipment and other property (other than equipment permitted to be stored) must be removed at the end of each hiring or fees will be charged at the hire fee per hiring until the same is removed. In the event of either:",
    ],
    bullets: [
      "the failure of the Hirer to pay any charges due and payable in respect of stored equipment, or to remove the same within 7 days after the agreed storage period has ended; or",
      "the failure of the Hirer to dispose of any property brought onto the premises for the purposes of the hiring, the Trust may in its absolute discretion dispose of any such items or sale or otherwise on such terms and conditions as it thinks fit and charge the Hirer any costs incurred in storing or selling or otherwise disposing of the same.",
    ],
  },
  {
    heading: "Accidents and dangerous occurrences",
    paragraphs: [
      "All accidents involving injury to a member of the public MUST be reported promptly to the Booking Secretary and the relevant section of the Accident Book completed. Any dangerous occurrences or damage to the premises or failure of equipment whatsoever whilst on the premises must also be noted in the Accident Book and reported to the Booking Secretary as soon as possible.",
    ],
  },
  {
    heading: "Heating",
    paragraphs: [
      "The Hirer shall ensure that no unauthorised heating appliances shall be used on the premises when open to the public without the consent of the Trust. Portable Liquefied propane Gas (LPG) heating appliances shall not be used.",
    ],
  },
  {
    heading: "Explosives and flammable substances",
    paragraphs: ["The Hirer shall ensure that:"],
    bullets: [
      "Highly flammable substances, barbeques or pyrotechnics are not brought into or used on any part of the premises.",
      "No internal decorations of a combustible nature (e.g. polystyrene, cotton wool) shall be erected without the consent of the Trust. No decorations are to be put up near light fittings or heaters.",
      "No hiring may use any smoke effects or candles in their event.",
    ],
  },
  {
    heading: "Animals",
    paragraphs: [
      "The Hirer shall ensure that no animals (including birds), except assistance dogs are to be brought into the premises, other than for a special event agreed by the Trust. No animals whatsoever in the kitchen at any time.",
    ],
  },
  {
    heading: "Carparking",
    paragraphs: [
      "The Trust accepts no responsibility for loss or damage to vehicles, or their contents, of persons visiting the premises. Care must be taken not to block the entrance to the car park on the playing field. The space at the side of the village hall is reserved for emergency vehicles but may be used temporarily for unloading. All visitors should use the free public car park adjacent to the hall.",
    ],
  },
  {
    heading: "Sale of goods",
    paragraphs: [
      "The Hirer shall, if selling goods on the premises, comply with Fair Trading Laws and any code of practice used in connection with such sales.",
    ],
  },
  {
    heading: "Cancellation",
    paragraphs: [
      "If the Hirer wishes to cancel the booking before the date of the event and the Trust is unable to conclude a replacement booking, the Trust may, at their discretion, require payment of the fee or withhold part of any payment already made. The Trust reserves the right to cancel the hiring by written notice to the Hirer in the event of:",
    ],
    bullets: [
      "the premises being required for use as a Polling Station for a Parliamentary election or by-election.",
      "the Trust reasonably considers that such hiring will lead to a breach of licensing conditions, if applicable, or any other legal or statutory requirements, or that unlawful or unsuitable activities will take place at the premises as a result of such hiring.",
      "the premises becoming unfit for the use intended by the Hirer.",
      "an emergency requiring use of the premises as a shelter for the victims of flooding, snowstorm, fire, explosion, or those at risk of similar disasters.",
    ],
  },
  {
    heading: "",
    paragraphs: [
      "In any such case the Hirer shall be entitled to a refund of any deposit already paid, but the Trust shall not be liable to the Hirer for any resulting direct or indirect loss or damages whatsoever. The Trust may also cancel any hiring, including during the hiring itself, at its discretion upon any breach of the hire conditions.",
    ],
  },
  {
    heading: "No alterations and fly posting",
    paragraphs: [
      "No alterations or additions may be made to the premises, nor any fixtures be installed, or any placards, decorations or other articles be attached in any way to any part of the premises without the prior arrangement of the Booking Secretary. Any alteration, fixture or fitting or attachment so approved shall at the discretion of the Trust remain in the premises at the end of the hiring. It will become the property of the Trust unless removed by the Hirer who must make good to the satisfaction of the Trust any damage caused by the premises by such removal. No item may be affixed to the premises or the walls by any method (e.g. Blu-tack, drawing pins, adhesive tape or similar) and all notices placed on the notice boards.",
      "The Hirer shall not carry out or permit fly posting or any other form of unauthorised advertisements for any event taking place at the premises and shall indemnify each member of the Trust accordingly against all actions, claims and proceedings arising from any breach of this condition. Failure to observe this condition may lead to prosecution by the local authority.",
    ],
  },
  {
    heading: "End of hire",
    paragraphs: [
      "The Hirer shall vacate the premises promptly at the end of the hire period. The Hirer shall be responsible for leaving the premises and surrounding area in a clean and tidy condition, properly locked and secured unless directed otherwise and any contents temporarily removed from their usual positions replaced; otherwise, the Trust shall be at liberty to make an additional charge.",
    ],
  },
  {
    heading: "No rights",
    paragraphs: [
      "The Hiring agreement constitutes permission only to use the premises and confers no tenancy or other right of occupation on the Hirer.",
    ],
  },
  {
    heading: "Acceptance",
    paragraphs: [
      "These Terms and Conditions will have been made available to the Hirer at the time of making the booking. By proceeding with the booking the Hirer is deemed to have accepted these terms and conditions. The Trust reserves the right to amend these Conditions of Hire at any time at their discretion.",
    ],
  },
];
