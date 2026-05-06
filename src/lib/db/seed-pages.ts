import { db } from "@/lib/db";
import { pages } from "./schema";
import {
  doc,
  paragraph,
  heading,
  bulletList,
  inlineDoc,
  type TiptapJSON,
} from "@/lib/cms/render";

type PageSeed = {
  slug: string;
  title: string;
  metaDescription: string;
  blocks: Record<string, TiptapJSON>;
};

const pageSeeds: PageSeed[] = [
  // ── HOME ──
  {
    slug: "home",
    title: "Home",
    metaDescription:
      "Community facilities for Loddiswell Parish - Village Hall, Pavilion, Playing Fields, Tennis Courts. Book facilities, find events, and join our community lottery.",
    blocks: {
      hero_eyebrow: inlineDoc("Loddiswell, South Hams, Devon"),
      hero_title: inlineDoc("Heart of the / Village"),
      hero_subtitle: doc(
        paragraph(
          "The Playing Field & Village Hall Trust maintains community facilities for the benefit of everyone in Loddiswell Parish."
        )
      ),
      facilities_eyebrow: inlineDoc("Our Facilities"),
      facilities_title: inlineDoc("Community Spaces for Everyone"),
      facilities_body: doc(
        paragraph(
          "We maintain a range of community facilities in the heart of Loddiswell for residents, groups, and visitors to enjoy."
        )
      ),
      community_eyebrow: inlineDoc("Our Village"),
      community_title: inlineDoc("A Thriving Community"),
      community_body: doc(
        paragraph(
          "Loddiswell is a vibrant village in the South Hams, Devon, with a rich history dating back to Roman times. Our community supports a wide range of clubs and societies including tennis, football, short mat bowls, cubs, art club, WI, and much more."
        ),
        paragraph(
          "The Trust is run by a dedicated committee of volunteers who work to ensure our facilities are maintained and available for everyone to enjoy."
        )
      ),
      cta_eyebrow: inlineDoc("Support Loddiswell"),
      cta_title: inlineDoc("Join the Community Lottery"),
      cta_body: doc(
        paragraph(
          "Tickets are just £12 per year. Support the maintenance of our community facilities and enter the monthly prize draw."
        )
      ),
    },
  },

  // ── ABOUT ──
  {
    slug: "about",
    title: "About",
    metaDescription:
      "Learn about the Loddiswell Playing Field & Village Hall Trust - our history, mission, and the trustees who keep our community facilities running.",
    blocks: {
      header_label: inlineDoc("Who We Are"),
      header_title: inlineDoc("About the Trust"),
      header_subtitle: doc(
        paragraph(
          "The Loddiswell Playing Fields and Village Hall Trust was formed to maintain and manage community facilities for the benefit of Loddiswell Parish inhabitants."
        )
      ),
      history_title: inlineDoc("Our History"),
      history_body: doc(
        paragraph(
          "Loddiswell is a parish and village in the South Hams district of Devon, with a history stretching back to Roman times. The village was recorded in the Domesday Book in 1086, and its name is a corruption of “Saint Loda’s well.”"
        ),
        paragraph(
          "The Village Hall began life as a Church School in 1872. After two local schools merged in 1916, it became the Village Hall. The Trust itself grew from a Welcome Home Fund set up in 1947 to honour villagers returning from the Second World War. Local contributions bought the fields and built the Pavilion."
        ),
        paragraph(
          "The Trust was established to ensure the village’s community facilities — the Village Hall, Pavilion, Playing Fields, Tennis Courts, and Play Park — are properly maintained and available for everyone to use and enjoy."
        ),
        paragraph(
          "Run entirely by volunteers, the Trust committee meets regularly to oversee the upkeep of these vital community spaces and plan improvements for the future."
        )
      ),
      mission_title: inlineDoc("Our Mission"),
      mission_body: doc(
        paragraph(
          "Our mission is to maintain and improve the playing fields, village hall, and associated facilities for the recreational and social benefit of the people of Loddiswell Parish."
        ),
        paragraph("We aim to:"),
        bulletList(
          "Keep all facilities in good repair and fit for purpose",
          "Make facilities accessible and affordable for all community members",
          "Support local clubs, groups, and events that bring the community together",
          "Plan and deliver improvements that benefit future generations",
          "Raise funds to ensure the long-term sustainability of our facilities"
        )
      ),
      trustees_eyebrow: inlineDoc("The Committee"),
      trustees_title: inlineDoc("Our Trustees"),
      trustees_intro: doc(
        paragraph(
          "The Trust is managed by a dedicated committee of volunteers from the local community. They give their time freely to ensure our facilities are well-maintained and available for everyone."
        )
      ),
      documents_title: inlineDoc("Documents"),
      documents_intro: doc(
        paragraph(
          "Meeting minutes, AGM documents, and policies are available below. These are regularly updated by the Trust committee."
        )
      ),
      documents_placeholder: doc(
        paragraph(
          "Documents will be available here once uploaded by the Trust committee."
        )
      ),
      cta_title: inlineDoc("Get Involved"),
      cta_body: doc(
        paragraph(
          "Whether you’d like to volunteer, join a club, or support the Trust through our community lottery, there are many ways to get involved."
        )
      ),
    },
  },

  // ── CONTACT ──
  {
    slug: "contact",
    title: "Contact",
    metaDescription:
      "Get in touch with the Loddiswell Playing Field & Village Hall Trust. Find us, email us, or call our Bookings Secretary.",
    blocks: {
      header_label: inlineDoc("Get in Touch"),
      header_title: inlineDoc("Contact Us"),
      header_subtitle: doc(
        paragraph(
          "Have a question, want to book a facility, or get involved? We’d love to hear from you."
        )
      ),
      form_eyebrow: inlineDoc("Write to Us"),
      form_title: inlineDoc("Send Us a Message"),
      details_eyebrow: inlineDoc("Contact Details"),
      details_title: inlineDoc("Get in Touch"),
      phone_note: inlineDoc("For urgent booking enquiries"),
    },
  },

  // ── BOOKING ──
  {
    slug: "booking",
    title: "Booking",
    metaDescription:
      "Book the Loddiswell Village Hall, Pavilion, or Tennis Courts. Check availability and hire rates for all our community facilities.",
    blocks: {
      header_label: inlineDoc("Hire Our Spaces"),
      header_title: inlineDoc("Book a Facility"),
      header_subtitle: doc(
        paragraph(
          "Check availability and hire rates for the Village Hall, Pavilion, and Tennis Courts. Contact us to make a booking."
        )
      ),
      availability_eyebrow: inlineDoc("Availability"),
      availability_title: inlineDoc("Availability Calendar"),
      availability_body: doc(
        paragraph(
          "The online booking calendar is coming soon. In the meantime, please contact our Bookings Secretary to check availability."
        )
      ),
      rates_eyebrow: inlineDoc("Pricing"),
      rates_title: inlineDoc("Hire Rates & Terms"),
      cta_eyebrow: inlineDoc("Support"),
      cta_title: inlineDoc("Need Help with Your Booking?"),
      cta_body: doc(
        paragraph(
          "If you have any questions about hiring our facilities, please don’t hesitate to get in touch."
        )
      ),
    },
  },

  // ── EVENTS ──
  {
    slug: "events",
    title: "Events",
    metaDescription:
      "Upcoming events in Loddiswell - community gatherings, sports, shows, and more at the Village Hall and Playing Fields.",
    blocks: {
      header_label: inlineDoc("What’s On"),
      header_title: inlineDoc("Events"),
      header_subtitle: doc(
        paragraph(
          "See what’s happening in Loddiswell. From community gatherings and sports events to club meetings and celebrations."
        )
      ),
      events_eyebrow: inlineDoc("Upcoming Events"),
      empty_state_title: inlineDoc("More Events Coming Soon"),
      empty_state_body: doc(
        paragraph(
          "Events will be regularly updated by the Trust committee. Check back soon or follow us for the latest updates."
        )
      ),
      cta_eyebrow: inlineDoc("Get Involved"),
      cta_title: inlineDoc("Want to Host an Event?"),
      cta_body: doc(
        paragraph(
          "Our Village Hall and Pavilion are available for hire. Get in touch to discuss your event."
        )
      ),
    },
  },

  // ── FACILITIES (index) ──
  {
    slug: "facilities",
    title: "Facilities",
    metaDescription:
      "Explore Loddiswell's community facilities - Village Hall, Pavilion, Tennis Courts, Playing Field, and more. Available for hire and community use.",
    blocks: {
      header_label: inlineDoc("What We Offer"),
      header_title: inlineDoc("Our Facilities"),
      header_subtitle: doc(
        paragraph(
          "We maintain a range of community facilities in the heart of Loddiswell for residents, groups, and visitors to enjoy."
        )
      ),
      cta_title: inlineDoc("Want to Book a Facility?"),
      cta_body: doc(
        paragraph(
          "Check availability and make a booking for the village hall, pavilion, or tennis courts."
        )
      ),
    },
  },

  // ── LOTTERY ──
  {
    slug: "lottery",
    title: "Community Lottery",
    metaDescription:
      "Join the Loddiswell Community Lottery! Tickets are just £12 per year. Support local facilities and win prizes.",
    blocks: {
      header_label: inlineDoc("Community Lottery"),
      header_title: inlineDoc("Community Lottery"),
      header_subtitle: doc(
        paragraph(
          "Support the Trust and help maintain our community facilities. Every ticket makes a difference to Loddiswell."
        )
      ),
      how_it_works_eyebrow: inlineDoc("How It Works"),
      how_it_works_title: inlineDoc("How It Works"),
      how_it_works_intro: doc(
        paragraph(
          "It’s simple — buy a ticket, support the village, and you could win a prize!"
        )
      ),
      step_buy_title: inlineDoc("Buy a Ticket"),
      step_buy_body: doc(
        paragraph(
          "Each ticket is just £12 for the year — that’s only £1 a month. Buy as many as you like!"
        )
      ),
      step_draw_title: inlineDoc("Enter the Draw"),
      step_draw_body: doc(
        paragraph(
          "Each ticket goes into the monthly draw for one full year from the date of purchase."
        )
      ),
      step_support_title: inlineDoc("Support the Village"),
      step_support_body: doc(
        paragraph(
          "All proceeds go directly to maintaining and improving Loddiswell’s community facilities."
        )
      ),
      purchase_price: inlineDoc("£12 per ticket"),
      purchase_period: inlineDoc("per year"),
      purchase_body: doc(
        paragraph(
          "Each ticket is just £12 for the year — that’s £1 a month. Buy 2 or more tickets to make an even bigger difference to the village!"
        ),
        paragraph(
          "If you can afford more, then please do — every ticket helps."
        )
      ),
      faq_eyebrow: inlineDoc("FAQ"),
      faq_title: inlineDoc("Frequently Asked Questions"),
      faq_q1: inlineDoc("How much does a ticket cost?"),
      faq_a1: doc(
        paragraph(
          "Each lottery ticket costs £12 per year. You can purchase as many tickets as you like — each ticket is entered into every monthly draw for a full year."
        )
      ),
      faq_q2: inlineDoc("How often are draws held?"),
      faq_a2: doc(
        paragraph(
          "Draws are held monthly. Winners are announced through the village newsletter and on this website."
        )
      ),
      faq_q3: inlineDoc("Where does the money go?"),
      faq_a3: doc(
        paragraph(
          "All proceeds (minus prizes) go directly to the Loddiswell Playing Fields and Village Hall Trust to maintain and improve our community facilities — the Village Hall, Pavilion, Playing Fields, Tennis Courts, and Play Park."
        )
      ),
      faq_q4: inlineDoc("Can I buy more than one ticket?"),
      faq_a4: doc(
        paragraph(
          "Absolutely! You can buy as many tickets as you like. Each ticket gives you an additional entry into every monthly draw. Buying 2 tickets for £24 doubles your chances and makes an even bigger difference to the village."
        )
      ),
    },
  },

  // ── PRIVACY ──
  {
    slug: "privacy",
    title: "Privacy Policy",
    metaDescription:
      "Privacy policy for the Loddiswell Playing Field & Village Hall Trust website.",
    blocks: {
      header_label: inlineDoc("Legal"),
      header_title: inlineDoc("Privacy Policy"),
      section_1: doc(
        heading(2, "1. Who We Are"),
        paragraph(
          "This website is operated by the Loddiswell Playing Fields and Village Hall Trust. Our contact email is hello@loddiswellcommunitytrust.org."
        )
      ),
      section_2: doc(
        heading(2, "2. What Data We Collect"),
        paragraph("We may collect the following personal data:"),
        bulletList(
          "Name and email address (via the contact form)",
          "Name, email, and payment details (for lottery ticket purchases, processed securely via Stripe)",
          "Booking enquiry details",
          "Website usage data via cookies (see section 6)"
        )
      ),
      section_3: doc(
        heading(2, "3. How We Use Your Data"),
        paragraph("We use your personal data to:"),
        bulletList(
          "Respond to your enquiries and messages",
          "Process lottery ticket purchases and manage your entry",
          "Manage facility bookings",
          "Send you information about community events (only if you have opted in)"
        )
      ),
      section_4: doc(
        heading(2, "4. Data Sharing"),
        paragraph(
          "We do not sell, trade, or rent your personal data to third parties. We may share data with trusted service providers who assist us in operating the website (e.g., Stripe for payment processing, Vercel for website hosting). These providers are contractually obligated to protect your data."
        )
      ),
      section_5: doc(
        heading(2, "5. Data Retention"),
        paragraph(
          "We retain personal data only for as long as necessary for the purposes for which it was collected. Contact form submissions are retained for up to 12 months. Lottery subscriber data is retained for the duration of participation plus 12 months. You can request deletion of your data at any time."
        )
      ),
      section_6: doc(
        heading(2, "6. Cookies"),
        paragraph(
          "This website uses essential cookies that are necessary for the website to function properly. We do not use tracking or advertising cookies. Essential cookies include authentication tokens for site administrators."
        )
      ),
      section_7: doc(
        heading(2, "7. Your Rights"),
        paragraph(
          "Under UK data protection law (UK GDPR), you have the right to:"
        ),
        bulletList(
          "Access the personal data we hold about you",
          "Request correction of inaccurate data",
          "Request deletion of your data",
          "Object to processing of your data",
          "Request transfer of your data"
        ),
        paragraph(
          "To exercise any of these rights, please contact us at hello@loddiswellcommunitytrust.org."
        )
      ),
      section_8: doc(
        heading(2, "8. Changes to This Policy"),
        paragraph(
          "We may update this privacy policy from time to time. Any changes will be posted on this page with an updated revision date."
        )
      ),
      last_updated: inlineDoc("Last updated: February 2026"),
    },
  },

  // ── TERMS ──
  {
    slug: "terms",
    title: "Terms & Conditions",
    metaDescription:
      "Terms and conditions for the Loddiswell Playing Field & Village Hall Trust website.",
    blocks: {
      header_label: inlineDoc("Legal"),
      header_title: inlineDoc("Terms & Conditions"),
      section_1: doc(
        heading(2, "1. Introduction"),
        paragraph(
          "These terms and conditions govern your use of the Loddiswell Playing Field & Village Hall Trust website. By using this website, you accept these terms in full."
        )
      ),
      section_2: doc(
        heading(2, "2. Use of Website"),
        paragraph(
          "This website is provided for the benefit of the Loddiswell community. You must not use the website in any way that causes, or may cause, damage to the website or impairment of the availability or accessibility of the website."
        )
      ),
      section_3: doc(
        heading(2, "3. Facility Hire"),
        paragraph(
          "All facility bookings are subject to the Trust’s hire terms and conditions, which are provided at the time of booking. The Trust reserves the right to refuse or cancel bookings at its discretion."
        )
      ),
      section_4: doc(
        heading(2, "4. Community Lottery"),
        paragraph(
          "The Loddiswell Community Lottery is operated by the Loddiswell Playing Fields and Village Hall Trust. Lottery tickets cost £12 each per year. Participants must be 16 years or older. The Trust reserves the right to amend lottery rules with reasonable notice."
        )
      ),
      section_5: doc(
        heading(2, "5. Intellectual Property"),
        paragraph(
          "Unless otherwise stated, the Trust owns the intellectual property rights in the website and material on the website. All content is protected by copyright."
        )
      ),
      section_6: doc(
        heading(2, "6. Limitation of Liability"),
        paragraph(
          "The information on this website is provided free of charge, and you acknowledge that it would be unreasonable to hold us liable in respect of this website and the information on this website. We will not be liable for any loss or damage arising from the use of this website."
        )
      ),
      section_7: doc(
        heading(2, "7. Changes to Terms"),
        paragraph(
          "The Trust may revise these terms from time to time. Revised terms will apply to the use of this website from the date of publication. Please check this page regularly to ensure you are familiar with the current version."
        )
      ),
      section_8: doc(
        heading(2, "8. Contact"),
        paragraph(
          "If you have any questions about these terms, please contact us at hello@loddiswellcommunitytrust.org."
        )
      ),
    },
  },
];

export async function seedPages() {
  console.log("Seeding pages...");
  for (const page of pageSeeds) {
    await db
      .insert(pages)
      .values({
        slug: page.slug,
        title: page.title,
        metaDescription: page.metaDescription,
        content: JSON.stringify(page.blocks),
      })
      .onConflictDoNothing({ target: pages.slug });
    console.log(`  ✓ ${page.slug}`);
  }
  console.log("Pages seeded.");
}
