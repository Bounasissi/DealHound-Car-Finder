import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("USER"),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ emailUnique: uniqueIndex("users_email_unique").on(table.email) }));

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ tokenUnique: uniqueIndex("sessions_token_hash_unique").on(table.tokenHash) }));

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull().default("USER"),
  tokenHash: text("token_hash").notNull(),
  invitedBy: text("invited_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ tokenUnique: uniqueIndex("invitations_token_hash_unique").on(table.tokenHash) }));

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ tokenUnique: uniqueIndex("password_reset_token_hash_unique").on(table.tokenHash) }));

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  minimumScore: integer("minimum_score").notNull().default(75),
  minimumMargin: numeric("minimum_margin", { precision: 12, scale: 2 }).notNull().default("2000"),
  deliveryMode: text("delivery_mode").notNull().default("IMMEDIATE"),
  quietHoursStart: integer("quiet_hours_start"),
  quietHoursEnd: integer("quiet_hours_end"),
  email: text("email"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  payload: jsonb("payload").notNull(),
  state: text("state").notNull().default("QUEUED"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  retryAt: timestamp("retry_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ idempotencyUnique: uniqueIndex("jobs_owner_idempotency_unique").on(table.ownerId, table.idempotencyKey) }));

export const usageCounters = pgTable("usage_counters", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  day: text("day").notNull(),
  metric: text("metric").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ usageUnique: uniqueIndex("usage_owner_day_metric_unique").on(table.ownerId, table.day, table.metric) }));

export const searchProfiles = pgTable("search_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  name: text("name").notNull(),
  zip: text("zip").notNull(),
  radiusMiles: integer("radius_miles").notNull().default(100),
  make: text("make"),
  model: text("model"),
  trim: text("trim"),
  yearMin: integer("year_min"),
  yearMax: integer("year_max"),
  mileageMax: integer("mileage_max"),
  priceMin: numeric("price_min", { precision: 10, scale: 2 }),
  priceMax: numeric("price_max", { precision: 10, scale: 2 }),
  maxAskingRatio: numeric("max_asking_ratio", { precision: 5, scale: 4 }).notNull().default("0.7000"),
  requireKbbReference: boolean("require_kbb_reference").notNull().default(true),
  maxAllInRatio: numeric("max_all_in_ratio", { precision: 5, scale: 4 }).notNull().default("0.8000"),
  requireCleanTitle: boolean("require_clean_title").notNull().default(true),
  requireRepairEvidence: boolean("require_repair_evidence").notNull().default(true),
  allowedRepairCategories: jsonb("allowed_repair_categories").$type<string[]>().notNull().default([]),
  rejectedRepairCategories: jsonb("rejected_repair_categories").$type<string[]>().notNull().default([]),
  maxExpectedRepairs: numeric("max_expected_repairs", { precision: 10, scale: 2 }),
  minDealMargin: numeric("min_deal_margin", { precision: 10, scale: 2 }).notNull().default("2000"),
  maxFraudRiskScore: integer("max_fraud_risk_score").notNull().default(40),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const listings = pgTable("listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  sourceId: text("source_id").notNull(),
  sourceKind: text("source_kind").notNull(),
  sourceListingId: text("source_listing_id"),
  url: text("url"),
  rawText: text("raw_text"),
  title: text("title"),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }),
  priceHistory: jsonb("price_history").$type<Array<{ price: number; at: string; note?: string }>>().notNull().default([]),
  mileage: integer("mileage"),
  location: text("location"),
  vin: text("vin"),
  vinConfidence: text("vin_confidence").notNull().default("NONE"),
  vehicleYear: integer("vehicle_year"),
  vehicleMake: text("vehicle_make"),
  vehicleModel: text("vehicle_model"),
  vehicleTrim: text("vehicle_trim"),
  sellerName: text("seller_name"),
  sellerType: text("seller_type").notNull().default("unknown"),
  sellerContact: text("seller_contact"),
  photos: jsonb("photos").$type<Array<{ url?: string; note?: string; analyzedFindings?: string[] }>>().notNull().default([]),
  titleClaims: jsonb("title_claims").$type<Array<{ claim: string; claimedClean: boolean; source: string; capturedAt: string; evidenceNote?: string }>>().notNull().default([]),
  titleState: text("title_state").notNull().default("UNKNOWN"),
  parsedIssues: jsonb("parsed_issues").$type<Array<{ category: string; snippet: string; confidence: number }>>().notNull().default([]),
  redFlags: jsonb("red_flags").$type<Array<{ code: string; description: string; detectedAt: string }>>().notNull().default([]),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  dedupKey: text("dedup_key").notNull(),
  workflowStage: text("workflow_stage").notNull().default("FOUND"),
  workflowHistory: jsonb("workflow_history").$type<Array<{ from: string; to: string; at: string; actor: string; note?: string }>>().notNull().default([]),
  watched: boolean("watched").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const valuations = pgTable("valuations", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  basis: text("basis").notNull().default("UNKNOWN"),
  referenceGoodValue: numeric("reference_good_value", { precision: 10, scale: 2 }).notNull(),
  compMedian: numeric("comp_median", { precision: 10, scale: 2 }),
  compRangeLow: numeric("comp_range_low", { precision: 10, scale: 2 }),
  compRangeHigh: numeric("comp_range_high", { precision: 10, scale: 2 }),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull().default("0.800"),
  notes: text("notes"),
  enteredBy: text("entered_by").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const historyChecks = pgTable("history_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  vin: text("vin").notNull(),
  titleState: text("title_state").notNull(),
  brands: jsonb("brands").$type<string[]>().notNull().default([]),
  accidentCount: integer("accident_count"),
  odometerReadings: jsonb("odometer_readings").$type<number[]>().notNull().default([]),
  raw: jsonb("raw"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userIssues = pgTable("user_issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull().default("0.900"),
  estimateLow: numeric("estimate_low", { precision: 10, scale: 2 }).notNull(),
  estimateExpected: numeric("estimate_expected", { precision: 10, scale: 2 }).notNull(),
  estimateHigh: numeric("estimate_high", { precision: 10, scale: 2 }).notNull(),
  majorRisk: boolean("major_risk").notNull().default(false),
  source: text("source").notNull().default("USER_INPUT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const evaluations = pgTable("evaluations", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").references(() => searchProfiles.id, { onDelete: "set null" }),
  score: integer("score").notNull(),
  scoreClass: text("score_class").notNull(),
  formulaVersion: text("formula_version").notNull().default("deal-score-v1"),
  askingRatio: numeric("asking_ratio", { precision: 6, scale: 4 }),
  gateAPassed: boolean("gate_a_passed"),
  gateBPassed: boolean("gate_b_passed"),
  expectedMargin: numeric("expected_margin", { precision: 12, scale: 2 }),
  fraudRiskScore: integer("fraud_risk_score"),
  hardRejected: boolean("hard_rejected").notNull().default(false),
  payload: jsonb("payload").notNull(), // full DealEvaluation — auditable decision record
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  evaluationId: uuid("evaluation_id").references(() => evaluations.id, { onDelete: "cascade" }),
  alertKey: text("alert_key").notNull(),
  payload: jsonb("payload").notNull(),
  delivered: boolean("delivered").notNull().default(false),
  deliveryStatus: text("delivery_status").notNull().default("PENDING"),
  deliveryAttempts: integer("delivery_attempts").notNull().default(0),
  deliveryError: text("delivery_error"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ alertKeyUnique: uniqueIndex("alerts_owner_key_unique").on(table.ownerId, table.alertKey) }));

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  alertId: uuid("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  attempts: integer("attempts").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outcomes = pgTable("outcomes", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  evaluationId: uuid("evaluation_id").references(() => evaluations.id, { onDelete: "set null" }),
  outcome: text("outcome").notNull(),
  notes: text("notes"),
  actualRepairs: numeric("actual_repairs", { precision: 10, scale: 2 }),
  actualFinishedValue: numeric("actual_finished_value", { precision: 10, scale: 2 }),
  actualAllIn: numeric("actual_all_in", { precision: 10, scale: 2 }),
  actualMargin: numeric("actual_margin", { precision: 10, scale: 2 }),
  soldPrice: numeric("sold_price", { precision: 10, scale: 2 }),
  predictionError: jsonb("prediction_error"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inspections = pgTable("inspections", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("SCHEDULED"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  findings: jsonb("findings").$type<string[]>().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ ownerListingUnique: uniqueIndex("inspections_owner_listing_unique").on(table.ownerId, table.listingId) }));

export const offers = pgTable("offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("DRAFT"),
  notes: text("notes"),
  madeAt: timestamp("made_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  targetPurchasePrice: numeric("target_purchase_price", { precision: 12, scale: 2 }),
  maximumPurchasePrice: numeric("maximum_purchase_price", { precision: 12, scale: 2 }),
  expectedMarginAtAsking: numeric("expected_margin_at_asking", { precision: 12, scale: 2 }),
  expectedMarginAtOffer: numeric("expected_margin_at_offer", { precision: 12, scale: 2 }),
  worstCaseMarginAtAsking: numeric("worst_case_margin_at_asking", { precision: 12, scale: 2 }),
  worstCaseMarginAtOffer: numeric("worst_case_margin_at_offer", { precision: 12, scale: 2 }),
  payload: jsonb("payload"),
});

export const sellerInteractions = pgTable("seller_interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().default("primary"),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  body: text("body").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vinCache = pgTable("vin_cache", {
  vin: text("vin").primaryKey(),
  decoded: jsonb("decoded").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inspectionItems = pgTable("inspection_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  inspectionId: uuid("inspection_id").notNull().references(() => inspections.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  label: text("label").notNull(),
  result: text("result").notNull().default("NOT_CHECKED"),
  note: text("note"),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
}, (table) => ({ codeUnique: uniqueIndex("inspection_items_code_unique").on(table.inspectionId, table.code) }));

export const listingFeedback = pgTable("listing_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  evaluationId: uuid("evaluation_id").references(() => evaluations.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  message: text("message").notNull(),
  snapshot: jsonb("snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
