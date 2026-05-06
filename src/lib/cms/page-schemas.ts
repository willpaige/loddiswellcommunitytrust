export type BlockType = "inline" | "richtext";

export type BlockSchema = {
  key: string;
  label: string;
  type: BlockType;
  group: string;
  help?: string;
};

export type PageSchema = {
  slug: string;
  title: string;
  blocks: BlockSchema[];
};

export const pageSchemas: Record<string, PageSchema> = {
  home: {
    slug: "home",
    title: "Home",
    blocks: [
      { key: "hero_eyebrow", label: "Hero eyebrow", type: "inline", group: "Hero" },
      { key: "hero_title", label: "Hero title", type: "inline", group: "Hero", help: "Use a forward slash / for a line break" },
      { key: "hero_subtitle", label: "Hero subtitle", type: "richtext", group: "Hero" },
      { key: "facilities_eyebrow", label: "Facilities section eyebrow", type: "inline", group: "Facilities section" },
      { key: "facilities_title", label: "Facilities section title", type: "inline", group: "Facilities section" },
      { key: "facilities_body", label: "Facilities section body", type: "richtext", group: "Facilities section" },
      { key: "community_eyebrow", label: "Community section eyebrow", type: "inline", group: "Community section" },
      { key: "community_title", label: "Community section title", type: "inline", group: "Community section" },
      { key: "community_body", label: "Community section body", type: "richtext", group: "Community section" },
      { key: "cta_eyebrow", label: "CTA eyebrow", type: "inline", group: "Lottery CTA" },
      { key: "cta_title", label: "CTA title", type: "inline", group: "Lottery CTA" },
      { key: "cta_body", label: "CTA body", type: "richtext", group: "Lottery CTA" },
    ],
  },
  about: {
    slug: "about",
    title: "About",
    blocks: [
      { key: "header_label", label: "Page header eyebrow", type: "inline", group: "Page header" },
      { key: "header_title", label: "Page header title", type: "inline", group: "Page header" },
      { key: "header_subtitle", label: "Page header subtitle", type: "richtext", group: "Page header" },
      { key: "history_title", label: "History title", type: "inline", group: "History" },
      { key: "history_body", label: "History body", type: "richtext", group: "History" },
      { key: "mission_title", label: "Mission title", type: "inline", group: "Mission" },
      { key: "mission_body", label: "Mission body", type: "richtext", group: "Mission", help: "Includes the bulleted aims" },
      { key: "trustees_eyebrow", label: "Trustees eyebrow", type: "inline", group: "Trustees" },
      { key: "trustees_title", label: "Trustees title", type: "inline", group: "Trustees" },
      { key: "trustees_intro", label: "Trustees intro", type: "richtext", group: "Trustees" },
      { key: "documents_title", label: "Documents title", type: "inline", group: "Documents" },
      { key: "documents_intro", label: "Documents intro", type: "richtext", group: "Documents" },
      { key: "documents_placeholder", label: "Documents placeholder", type: "richtext", group: "Documents" },
      { key: "cta_title", label: "Get Involved title", type: "inline", group: "Get Involved CTA" },
      { key: "cta_body", label: "Get Involved body", type: "richtext", group: "Get Involved CTA" },
    ],
  },
  contact: {
    slug: "contact",
    title: "Contact",
    blocks: [
      { key: "header_label", label: "Page header eyebrow", type: "inline", group: "Page header" },
      { key: "header_title", label: "Page header title", type: "inline", group: "Page header" },
      { key: "header_subtitle", label: "Page header subtitle", type: "richtext", group: "Page header" },
      { key: "form_eyebrow", label: "Form eyebrow", type: "inline", group: "Contact form" },
      { key: "form_title", label: "Form title", type: "inline", group: "Contact form" },
      { key: "details_eyebrow", label: "Details eyebrow", type: "inline", group: "Contact details" },
      { key: "details_title", label: "Details title", type: "inline", group: "Contact details" },
      { key: "phone_note", label: "Phone note", type: "inline", group: "Contact details" },
    ],
  },
  booking: {
    slug: "booking",
    title: "Booking",
    blocks: [
      { key: "header_label", label: "Page header eyebrow", type: "inline", group: "Page header" },
      { key: "header_title", label: "Page header title", type: "inline", group: "Page header" },
      { key: "header_subtitle", label: "Page header subtitle", type: "richtext", group: "Page header" },
      { key: "availability_eyebrow", label: "Availability eyebrow", type: "inline", group: "Availability" },
      { key: "availability_title", label: "Availability title", type: "inline", group: "Availability" },
      { key: "availability_body", label: "Availability body", type: "richtext", group: "Availability" },
      { key: "rates_eyebrow", label: "Rates eyebrow", type: "inline", group: "Hire rates" },
      { key: "rates_title", label: "Rates title", type: "inline", group: "Hire rates" },
      { key: "cta_eyebrow", label: "CTA eyebrow", type: "inline", group: "Contact CTA" },
      { key: "cta_title", label: "CTA title", type: "inline", group: "Contact CTA" },
      { key: "cta_body", label: "CTA body", type: "richtext", group: "Contact CTA" },
    ],
  },
  events: {
    slug: "events",
    title: "Events",
    blocks: [
      { key: "header_label", label: "Page header eyebrow", type: "inline", group: "Page header" },
      { key: "header_title", label: "Page header title", type: "inline", group: "Page header" },
      { key: "header_subtitle", label: "Page header subtitle", type: "richtext", group: "Page header" },
      { key: "events_eyebrow", label: "Upcoming events eyebrow", type: "inline", group: "Events list" },
      { key: "empty_state_title", label: "Empty state title", type: "inline", group: "Events list" },
      { key: "empty_state_body", label: "Empty state body", type: "richtext", group: "Events list" },
      { key: "cta_eyebrow", label: "CTA eyebrow", type: "inline", group: "Host event CTA" },
      { key: "cta_title", label: "CTA title", type: "inline", group: "Host event CTA" },
      { key: "cta_body", label: "CTA body", type: "richtext", group: "Host event CTA" },
    ],
  },
  facilities: {
    slug: "facilities",
    title: "Facilities",
    blocks: [
      { key: "header_label", label: "Page header eyebrow", type: "inline", group: "Page header" },
      { key: "header_title", label: "Page header title", type: "inline", group: "Page header" },
      { key: "header_subtitle", label: "Page header subtitle", type: "richtext", group: "Page header" },
      { key: "cta_title", label: "Booking CTA title", type: "inline", group: "Booking CTA" },
      { key: "cta_body", label: "Booking CTA body", type: "richtext", group: "Booking CTA" },
    ],
  },
  lottery: {
    slug: "lottery",
    title: "Community Lottery",
    blocks: [
      { key: "header_label", label: "Page header eyebrow", type: "inline", group: "Page header" },
      { key: "header_title", label: "Page header title", type: "inline", group: "Page header" },
      { key: "header_subtitle", label: "Page header subtitle", type: "richtext", group: "Page header" },
      { key: "how_it_works_eyebrow", label: "How it works eyebrow", type: "inline", group: "How it works" },
      { key: "how_it_works_title", label: "How it works title", type: "inline", group: "How it works" },
      { key: "how_it_works_intro", label: "How it works intro", type: "richtext", group: "How it works" },
      { key: "step_buy_title", label: "Step 1 title (Buy a Ticket)", type: "inline", group: "How it works" },
      { key: "step_buy_body", label: "Step 1 body", type: "richtext", group: "How it works" },
      { key: "step_draw_title", label: "Step 2 title (Enter the Draw)", type: "inline", group: "How it works" },
      { key: "step_draw_body", label: "Step 2 body", type: "richtext", group: "How it works" },
      { key: "step_support_title", label: "Step 3 title (Support the Village)", type: "inline", group: "How it works" },
      { key: "step_support_body", label: "Step 3 body", type: "richtext", group: "How it works" },
      { key: "purchase_price", label: "Purchase price headline", type: "inline", group: "Ticket purchase" },
      { key: "purchase_period", label: "Purchase period", type: "inline", group: "Ticket purchase" },
      { key: "purchase_body", label: "Purchase body", type: "richtext", group: "Ticket purchase" },
      { key: "faq_eyebrow", label: "FAQ eyebrow", type: "inline", group: "FAQ" },
      { key: "faq_title", label: "FAQ title", type: "inline", group: "FAQ" },
      { key: "faq_q1", label: "FAQ Q1", type: "inline", group: "FAQ" },
      { key: "faq_a1", label: "FAQ A1", type: "richtext", group: "FAQ" },
      { key: "faq_q2", label: "FAQ Q2", type: "inline", group: "FAQ" },
      { key: "faq_a2", label: "FAQ A2", type: "richtext", group: "FAQ" },
      { key: "faq_q3", label: "FAQ Q3", type: "inline", group: "FAQ" },
      { key: "faq_a3", label: "FAQ A3", type: "richtext", group: "FAQ" },
      { key: "faq_q4", label: "FAQ Q4", type: "inline", group: "FAQ" },
      { key: "faq_a4", label: "FAQ A4", type: "richtext", group: "FAQ" },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    blocks: [
      { key: "header_label", label: "Page header eyebrow", type: "inline", group: "Page header" },
      { key: "header_title", label: "Page header title", type: "inline", group: "Page header" },
      { key: "section_1", label: "Section 1", type: "richtext", group: "Sections", help: "Include the H2 heading inside the body" },
      { key: "section_2", label: "Section 2", type: "richtext", group: "Sections" },
      { key: "section_3", label: "Section 3", type: "richtext", group: "Sections" },
      { key: "section_4", label: "Section 4", type: "richtext", group: "Sections" },
      { key: "section_5", label: "Section 5", type: "richtext", group: "Sections" },
      { key: "section_6", label: "Section 6", type: "richtext", group: "Sections" },
      { key: "section_7", label: "Section 7", type: "richtext", group: "Sections" },
      { key: "section_8", label: "Section 8", type: "richtext", group: "Sections" },
      { key: "last_updated", label: "Last updated", type: "inline", group: "Sections" },
    ],
  },
  terms: {
    slug: "terms",
    title: "Terms & Conditions",
    blocks: [
      { key: "header_label", label: "Page header eyebrow", type: "inline", group: "Page header" },
      { key: "header_title", label: "Page header title", type: "inline", group: "Page header" },
      { key: "section_1", label: "Section 1", type: "richtext", group: "Sections", help: "Include the H2 heading inside the body" },
      { key: "section_2", label: "Section 2", type: "richtext", group: "Sections" },
      { key: "section_3", label: "Section 3", type: "richtext", group: "Sections" },
      { key: "section_4", label: "Section 4", type: "richtext", group: "Sections" },
      { key: "section_5", label: "Section 5", type: "richtext", group: "Sections" },
      { key: "section_6", label: "Section 6", type: "richtext", group: "Sections" },
      { key: "section_7", label: "Section 7", type: "richtext", group: "Sections" },
      { key: "section_8", label: "Section 8", type: "richtext", group: "Sections" },
    ],
  },
};

export const pageSlugs = Object.keys(pageSchemas);

export function groupBlocks(schema: PageSchema): Array<{ group: string; blocks: BlockSchema[] }> {
  const order: string[] = [];
  const map = new Map<string, BlockSchema[]>();
  for (const block of schema.blocks) {
    if (!map.has(block.group)) {
      order.push(block.group);
      map.set(block.group, []);
    }
    map.get(block.group)!.push(block);
  }
  return order.map((group) => ({ group, blocks: map.get(group)! }));
}
