import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ── Auth.js required tables ──

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: text("role", { enum: ["admin", "editor", "customer"] })
    .notNull()
    .default("customer"),
  discountPercent: integer("discount_percent").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ── Application tables ──

export const pages = pgTable("pages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull().default("{}"),
  metaDescription: text("meta_description"),
  heroImageUrl: text("hero_image_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => users.id),
});

export const events = pgTable("events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  seriesId: text("series_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default("{}"),
  location: text("location"),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  endDate: timestamp("end_date", { mode: "date" }),
  allDay: boolean("all_day").default(false),
  imageUrl: text("image_url"),
  externalUrl: text("external_url"),
  published: boolean("published").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: text("created_by").references(() => users.id),
});

export const facilities = pgTable("facilities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default("{}"),
  address: text("address"),
  what3words: text("what3words"),
  capacity: integer("capacity"),
  features: jsonb("features").$type<string[]>(),
  heroImageUrl: text("hero_image_url"),
  rates: jsonb("rates").$type<Record<string, string>>(),
  bookingTerms: jsonb("booking_terms").$type<string[]>(),
  bookingInfo: text("booking_info"),
  externalBookingUrl: text("external_booking_url"),
  accessInstructions: text("access_instructions"),
  bookableStartTime: text("bookable_start_time").notNull().default("08:00"),
  bookableEndTime: text("bookable_end_time").notNull().default("23:00"),
  bookable: boolean("bookable").default(true),
  sortOrder: integer("sort_order").default(0),
  published: boolean("published").default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const eventSeries = pgTable("event_series", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  title: text("title").notNull(),
  description: text("description").notNull().default("{}"),
  location: text("location"),
  imageUrl: text("image_url"),
  externalUrl: text("external_url"),
  published: boolean("published").default(true),
  allDay: boolean("all_day").default(false),
  recurrence: text("recurrence", { enum: ["monthly_nth_weekday"] }).notNull(),
  weekOfMonth: integer("week_of_month").notNull(),
  weekday: integer("weekday").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  startMonth: timestamp("start_month", { mode: "date" }).notNull(),
  monthsAhead: integer("months_ahead").notNull().default(18),
  excludeMonths: jsonb("exclude_months").$type<number[]>().notNull().default([]),
  blockFacilityId: text("block_facility_id").references(() => facilities.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: text("created_by").references(() => users.id),
});

export const facilityImages = pgTable("facility_images", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  altText: text("alt_text").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  title: text("title").notNull(),
  category: text("category", {
    enum: ["minutes", "agm", "policy", "report", "other"],
  }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  publishedDate: timestamp("published_date", { mode: "date" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  uploadedBy: text("uploaded_by").references(() => users.id),
});

export const images = pgTable("images", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  url: text("url").notNull(),
  altText: text("alt_text").notNull(),
  width: integer("width"),
  height: integer("height"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  uploadedBy: text("uploaded_by").references(() => users.id),
});

export const auditLog = pgTable("audit_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").references(() => users.id),
  userEmail: text("user_email"),
  action: text("action", {
    enum: ["create", "update", "delete", "publish", "unpublish", "upload", "login"],
  }).notNull(),
  entity: text("entity", {
    enum: ["event", "page", "facility", "document", "image", "lottery", "user", "booking", "requirement_set"],
  }).notNull(),
  entityId: text("entity_id"),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trustees = pgTable("trustees", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  role: text("role").notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const lotteryDraws = pgTable("lottery_draws", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  drawDate: timestamp("draw_date", { mode: "date" }).notNull(),
  results: jsonb("results")
    .$type<Array<{ rank: number; winner: string; prize: string; ticketNumber?: number }>>()
    .notNull(),
  notes: text("notes"),
  published: boolean("published").notNull().default(true),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").references(() => users.id),
});

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text("email").notNull().unique(),
  status: text("status", { enum: ["active", "unsubscribed"] })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const lotteryTickets = pgTable("lottery_tickets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  source: text("source", { enum: ["stripe", "manual"] })
    .notNull()
    .default("stripe"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  stripePaymentId: text("stripe_payment_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  billingInterval: text("billing_interval", { enum: ["month", "year"] }),
  quantity: integer("quantity").notNull().default(1),
  amount: integer("amount").notNull(), // pence
  purchaseDate: timestamp("purchase_date", { mode: "date" }).notNull().defaultNow(),
  expiryDate: timestamp("expiry_date", { mode: "date" }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: timestamp("canceled_at"),
  notes: text("notes"),
  status: text("status", {
    enum: ["active", "expired", "refunded", "canceled", "past_due"],
  })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const lotteryTicketNumbers = pgTable(
  "lottery_ticket_numbers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => lotteryTickets.id, { onDelete: "cascade" }),
    ticketNumber: integer("ticket_number").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lottery_ticket_numbers_number_idx").on(table.ticketNumber),
    index("lottery_ticket_numbers_ticket_idx").on(table.ticketId),
  ]
);

export const bookingOfferings = pgTable("booking_offerings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["hourly", "morning", "afternoon", "evening", "full_day", "kids_party"],
  }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  capacity: integer("capacity").notNull().default(1),
  startTime: text("start_time"),
  endTime: text("end_time"),
  allowedDays: jsonb("allowed_days").$type<number[]>().notNull().default([0, 1, 2, 3, 4, 5, 6]),
  active: boolean("active").notNull().default(true),
  requirementSetId: text("requirement_set_id").references(() => requirementSets.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookingPrices = pgTable("booking_prices", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  offeringId: text("offering_id")
    .notNull()
    .references(() => bookingOfferings.id, { onDelete: "cascade" }),
  customerGroup: text("customer_group", {
    enum: ["parent_private", "team_community", "business"],
  }).notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookingDiscountCodes = pgTable(
  "booking_discount_codes",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    code: text("code").notNull(),
    description: text("description"),
    discountPercent: integer("discount_percent").notNull(),
    validFrom: timestamp("valid_from", { mode: "date" }),
    validUntil: timestamp("valid_until", { mode: "date" }),
    maxRedemptions: integer("max_redemptions"),
    maxRedemptionsPerCustomer: integer("max_redemptions_per_customer"),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("booking_discount_codes_code_idx").on(table.code)]
);

export const bookings = pgTable(
  "bookings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    offeringId: text("offering_id").references(() => bookingOfferings.id, { onDelete: "set null" }),
    customerGroup: text("customer_group", {
      enum: ["parent_private", "team_community", "business"],
    }).notNull(),
    customerName: text("customer_name").notNull(),
    organisationName: text("organisation_name"),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    notes: text("notes"),
    status: text("status", {
      enum: ["pending_payment", "confirmed", "cancelled", "payment_failed"],
    }).notNull().default("pending_payment"),
    paymentType: text("payment_type", { enum: ["one_off", "subscription", "manual"] })
      .notNull()
      .default("one_off"),
    amount: integer("amount").notNull().default(0),
    discountCodeId: text("discount_code_id").references(() => bookingDiscountCodes.id, {
      onDelete: "set null",
    }),
    discountCode: text("discount_code"),
    discountPercent: integer("discount_percent").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    startDate: timestamp("start_date", { mode: "date" }).notNull(),
    endDate: timestamp("end_date", { mode: "date" }).notNull(),
    recurrence: text("recurrence", {
      enum: ["none", "weekly", "bi_weekly", "monthly", "quarterly", "yearly"],
    }).notNull().default("none"),
    scheduleType: text("schedule_type", { enum: ["regular", "custom"] })
      .notNull()
      .default("regular"),
    indefinite: boolean("indefinite").notNull().default(false),
    billingInterval: text("billing_interval", {
      enum: ["weekly", "bi_weekly", "monthly", "quarterly", "yearly"],
    }),
    repeatCount: integer("repeat_count").notNull().default(1),
    promoteOnSite: boolean("promote_on_site").notNull().default(false),
    promotionUrl: text("promotion_url"),
    promotionEventId: text("promotion_event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeInvoiceId: text("stripe_invoice_id").unique(),
    invoiceStatus: text("invoice_status", {
      enum: ["draft", "open", "paid", "uncollectible", "void"],
    }),
    invoiceHostedUrl: text("invoice_hosted_url"),
    invoicePdfUrl: text("invoice_pdf_url"),
    billingLine1: text("billing_line1"),
    billingLine2: text("billing_line2"),
    billingCity: text("billing_city"),
    billingPostcode: text("billing_postcode"),
    requirementSetId: text("requirement_set_id").references(() => requirementSets.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("bookings_facility_start_idx").on(table.facilityId, table.startDate),
    index("bookings_user_idx").on(table.userId),
  ]
);

export const bookingOccurrences = pgTable(
  "booking_occurrences",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    startDate: timestamp("start_date", { mode: "date" }).notNull(),
    endDate: timestamp("end_date", { mode: "date" }).notNull(),
    status: text("status", { enum: ["pending_payment", "confirmed", "cancelled"] })
      .notNull()
      .default("pending_payment"),
    allocatedAmount: integer("allocated_amount").notNull().default(0),
    promotionEventId: text("promotion_event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    refundStatus: text("refund_status", { enum: ["none", "due", "refunded"] })
      .notNull()
      .default("none"),
    refundAmount: integer("refund_amount").notNull().default(0),
    refundedAt: timestamp("refunded_at"),
    refundedBy: text("refunded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("booking_occurrences_facility_start_idx").on(table.facilityId, table.startDate),
    index("booking_occurrences_booking_idx").on(table.bookingId),
    uniqueIndex("booking_occurrences_booking_start_idx").on(table.bookingId, table.startDate),
  ]
);

// ── Post-booking requirements (questionnaires + document uploads) ──

export const requirementSets = pgTable("requirement_sets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const requirementQuestions = pgTable(
  "requirement_questions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    setId: text("set_id")
      .notNull()
      .references(() => requirementSets.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    type: text("type", { enum: ["yes_no", "text"] }).notNull().default("yes_no"),
    requiresDocumentOnYes: boolean("requires_document_on_yes").notNull().default(false),
    documentLabel: text("document_label"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("requirement_questions_set_idx").on(table.setId)]
);

export const bookingRequirementResponses = pgTable(
  "booking_requirement_responses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => requirementQuestions.id, { onDelete: "restrict" }),
    questionLabel: text("question_label").notNull(),
    answerBool: boolean("answer_bool"),
    answerText: text("answer_text"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("booking_requirement_responses_booking_question_idx").on(
      table.bookingId,
      table.questionId
    ),
  ]
);

export const bookingRequirementDocuments = pgTable(
  "booking_requirement_documents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => requirementQuestions.id, { onDelete: "restrict" }),
    documentLabel: text("document_label"),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    uploadedBy: text("uploaded_by").references(() => users.id),
  },
  (table) => [index("booking_requirement_documents_booking_idx").on(table.bookingId)]
);

export const bookingBlocks = pgTable(
  "booking_blocks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }),
    seriesId: text("series_id").references(() => bookingBlockSeries.id, { onDelete: "cascade" }),
    // Units of the offering's capacity this block consumes. NULL = the whole
    // facility, which is how every pre-existing and event-generated block behaves.
    capacity: integer("capacity"),
    startDate: timestamp("start_date", { mode: "date" }).notNull(),
    endDate: timestamp("end_date", { mode: "date" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    index("booking_blocks_facility_start_idx").on(table.facilityId, table.startDate),
    // One occurrence per series per start. Makes the rolling top-up idempotent
    // at the database level rather than relying on the watermark alone — a
    // mis-parsed watermark previously duplicated whole series nightly. Partial
    // so that one-off and event-linked blocks (series_id NULL) are unaffected.
    uniqueIndex("booking_blocks_series_start_idx")
      .on(table.seriesId, table.startDate)
      .where(sql`${table.seriesId} is not null`),
  ]
);

export const bookingBlockSeries = pgTable("booking_block_series", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  facilityId: text("facility_id").notNull().references(() => facilities.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  endDate: timestamp("end_date", { mode: "date" }).notNull(),
  recurrence: text("recurrence", {
    enum: ["weekly", "bi_weekly", "monthly", "quarterly", "yearly"],
  }).notNull(),
  indefinite: boolean("indefinite").notNull().default(false),
  repeatCount: integer("repeat_count").notNull().default(1),
  // Copied onto every generated block. NULL = the whole facility.
  capacity: integer("capacity"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
});

export const siteSettings = pgTable("site_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  mapLatitude: text("map_latitude").notNull().default("50.325178"),
  mapLongitude: text("map_longitude").notNull().default("-3.80193"),
  mapZoom: text("map_zoom").notNull().default("351"),
  emailAddress: text("email_address").notNull().default("hello@loddiswellcommunitytrust.org"),
  postalAddress: text("postal_address"),
  villageHallAddress: text("village_hall_address"),
  pavilionAddress: text("pavilion_address"),
  bookingsPhoneNumber: text("bookings_phone_number"),
  phoneNumber: text("phone_number"),
  bookingManagerEmail: text("booking_manager_email"),
  repeatBookingDiscountThreshold: integer("repeat_booking_discount_threshold").notNull().default(8),
  repeatBookingDiscountPercent: integer("repeat_booking_discount_percent").notNull().default(15),
  bookingCancellationNoticeHours: integer("booking_cancellation_notice_hours").notNull().default(48),
  legalName: text("legal_name"),
  charityNumber: text("charity_number"),
  bankAccountName: text("bank_account_name"),
  bankSortCode: text("bank_sort_code"),
  bankAccountNumber: text("bank_account_number"),
  invoiceFooterNote: text("invoice_footer_note"),
  invoiceDaysUntilDue: integer("invoice_days_until_due").notNull().default(14),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => users.id),
});

export const emailTemplates = pgTable("email_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  key: text("key").notNull().unique(),
  category: text("category", { enum: ["bookings", "lottery", "system"] }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  variables: jsonb("variables").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => users.id),
});

export const emailLogs = pgTable(
  "email_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    templateKey: text("template_key").notNull(),
    recipient: text("recipient").notNull(),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: text("related_entity_id"),
    status: text("status", { enum: ["sent", "skipped", "failed"] }).notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("email_logs_template_related_idx").on(
      table.templateKey,
      table.relatedEntityType,
      table.relatedEntityId
    ),
  ]
);
