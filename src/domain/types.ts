/**
 * DealHound Car Finder — core domain types.
 * Pure TypeScript: no framework or DB imports. Everything downstream builds on these.
 */

// ---------------------------------------------------------------------------
// Title & history
// ---------------------------------------------------------------------------

/** Lifecycle of title verification. Seller claims are NEVER treated as verified. */
export const TITLE_STATES = [
  "UNKNOWN",
  "SELLER_CLAIMS_CLEAN",
  "HISTORY_CLEAN",
  "DOCUMENT_REVIEWED",
  "VERIFIED",
] as const;
export type TitleState = (typeof TITLE_STATES)[number];

export const TITLE_STATE_RANK: Record<TitleState, number> = {
  UNKNOWN: 0,
  SELLER_CLAIMS_CLEAN: 1,
  HISTORY_CLEAN: 2,
  DOCUMENT_REVIEWED: 3,
  VERIFIED: 4,
};

/** Severe title brands that hard-reject a deal unless explicitly overridden. */
export const HARD_REJECT_BRANDS = [
  "SALVAGE",
  "REBUILT",
  "FLOOD",
  "JUNK",
  "PARTS_ONLY",
  "CERTIFICATE_OF_DESTRUCTION",
  "VIN_MISMATCH",
] as const;
export type HardRejectBrand = (typeof HARD_REJECT_BRANDS)[number];

export interface TitleClaim {
  claim: string; // e.g. "clean title", "salvage"
  claimedClean: boolean;
  source: "LISTING_TEXT" | "SELLER_MESSAGE" | "USER_INPUT";
  capturedAt: string; // ISO timestamp
  evidenceNote?: string;
}

export interface HistoryCheck {
  provider: string; // approved provider or explicit manual/seed provenance
  vin: string;
  titleState: TitleState;
  brands: string[]; // normalized brand codes, empty if clean
  accidentCount: number | null;
  odometerReadings: number[];
  raw?: unknown; // provider response retained for audit
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Vehicle & VIN
// ---------------------------------------------------------------------------

export interface VehicleAttributes {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyClass: string | null;
  fuelType: string | null;
  engineCylinders: number | null;
}

export interface VinDecodeResult {
  vin: string;
  valid: boolean;
  attributes: VehicleAttributes;
  /** 0–1 confidence that decode matches the listing's stated vehicle. */
  matchConfidence: number;
  mismatches: string[]; // human-readable field conflicts
  decodedAt: string;
  source: "nhtsa-vpic" | "cache" | "manual";
}

export type VinConfidence = "NONE" | "PROVIDED_UNVERIFIED" | "VALID_FORMAT" | "DECODED_MATCH" | "DECODED_MISMATCH";

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export type ListingSourceKind = "manual-ingestion" | "marketplace-screenshot" | "inventory-api" | "auction";

export interface ListingPhoto {
  url?: string;
  note?: string; // what the photo shows, entered by user or analyzer
  analyzedFindings?: string[];
}

export interface PricePoint {
  price: number;
  at: string; // ISO timestamp
  note?: string;
}

export interface RawListing {
  sourceId: string;
  sourceKind: ListingSourceKind;
  sourceListingId?: string;
  url?: string;
  rawText?: string;
  title?: string;
  description?: string;
  price?: number;
  mileage?: number;
  location?: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  sellerName?: string;
  sellerType?: "private" | "dealer" | "unknown";
  sellerContact?: string;
  photos?: ListingPhoto[];
  titleClaims?: TitleClaim[];
  postedAt?: string;
  priceHistory?: PricePoint[];
}

export interface RedFlag {
  code: string;
  description: string;
  detectedAt: string;
}

export interface NormalizedListing {
  id?: string;
  sourceId: string;
  sourceKind: ListingSourceKind;
  sourceListingId?: string;
  url?: string;
  rawText?: string;
  title?: string;
  description?: string;
  price: number | null;
  priceHistory: PricePoint[];
  mileage: number | null;
  location: string | null;
  vin: string | null;
  vinConfidence: VinConfidence;
  vehicle: VehicleAttributes;
  sellerName: string | null;
  sellerType: "private" | "dealer" | "unknown";
  sellerContact: string | null;
  photos: ListingPhoto[];
  titleClaims: TitleClaim[];
  titleState: TitleState;
  parsedIssues: ParsedIssueRef[]; // category refs extracted from text/photos
  redFlags: RedFlag[];
  postedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  dedupKey: string;
  /** Present once persisted; new listings start at the DB default ("FOUND"). */
  workflowStage?: WorkflowStage;
}

export interface ParsedIssueRef {
  category: RepairCategory;
  snippet: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Repairs
// ---------------------------------------------------------------------------

export const REPAIR_CATEGORIES = [
  "COSMETIC",
  "TIRES_BRAKES",
  "SUSPENSION",
  "BATTERY_STARTING_CHARGING",
  "BEARINGS_EXHAUST",
  "HVAC",
  "ELECTRICAL_SENSORS",
  "LEAKS_MISFIRES",
  "ENGINE_MAJOR",
  "TRANSMISSION_MAJOR",
  "RUST_FRAME_FLOOD_FIRE",
  "OTHER_MAINTENANCE",
] as const;
export type RepairCategory = (typeof REPAIR_CATEGORIES)[number];

export const SEVERITIES = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export type IssueSource = "TEXT_PARSE" | "PHOTO_ANALYSIS" | "SELLER_DISCLOSED" | "INSPECTION" | "USER_INPUT";

export interface RepairIssue {
  id: string;
  category: RepairCategory;
  description: string;
  severity: Severity;
  /** 0–1 how sure we are this issue exists / is correctly classified. */
  confidence: number;
  estimateLow: number;
  estimateExpected: number;
  estimateHigh: number;
  majorRisk: boolean;
  source: IssueSource;
}

export interface RepairEstimateSummary {
  issues: RepairIssue[];
  totalLow: number;
  totalExpected: number;
  totalHigh: number;
  hasMajorRisk: boolean;
  rejectedCategories: RepairCategory[]; // issues in categories the profile rejects
  /** True when no explicit repair evidence supports a zero-cost assumption. */
  unknownCosts: boolean;
  unknownReason: string | null;
}

// ---------------------------------------------------------------------------
// Valuation
// ---------------------------------------------------------------------------

export interface CompSale {
  price: number;
  mileage: number | null;
  year: number | null;
  conditionGuess?: string;
  source: string;
  observedAt: string;
}

export interface ValuationResult {
  provider: string;
  /** KBB-equivalent "Good" condition private-party reference value. */
  referenceGoodValue: number;
  compMedian: number | null;
  compRange: [number, number] | null;
  confidence: number; // 0–1
  notes: string;
  computedAt: string;
}

export interface ValuationBundle {
  results: ValuationResult[];
  /** Conservative chosen reference (lowest credible). */
  referenceGoodValue: number;
  chosenProvider: string;
  askingRatio: number | null; // asking / reference
  discountAmount: number | null;
  discountPct: number | null;
}

// ---------------------------------------------------------------------------
// Economics
// ---------------------------------------------------------------------------

export interface TransactionCostInputs {
  /** Sales tax + title/registration estimate rate applied to purchase price. */
  taxTitleFeeRate: number; // e.g. 0.08
  inspectionFee: number; // pre-purchase inspection
  transportationCost: number; // towing/delivery/fuel to bring home
}

export interface AllInBasisComponents {
  askingPrice: number;
  expectedRepairs: number;
  inspection: number;
  transportation: number;
  taxesTitleFees: number;
  immediateMaintenance: number;
  riskReserve: number;
  unknownRepairReserve: number;
}

export interface DealScenario {
  label: "best" | "expected" | "worst";
  allInBasis: number;
  components: AllInBasisComponents;
  margin: number; // finishedValue - allInBasis
  marginPct: number; // margin / finishedValue
  allInToValueRatio: number; // allInBasis / finishedValue
}

export interface DealEconomics {
  askingPrice: number;
  referenceGoodValue: number;
  askingRatio: number;
  conservativeFinishedValue: number;
  scenarios: DealScenario[];
  expectedAllInBasis: number;
  expectedMargin: number;
  expectedMarginPct: number;
  expectedAllInToValueRatio: number;
  gateA: { passed: boolean; detail: string };
  gateB: { passed: boolean; detail: string };
  bothGatesPassed: boolean;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const SCORE_CLASSES = ["EXCEPTIONAL", "STRONG_BUY", "INVESTIGATE", "HIGH_RISK", "REJECT"] as const;
export type ScoreClass = (typeof SCORE_CLASSES)[number];

export interface ScoreFactor {
  key: string;
  label: string;
  weight: number; // sums to 100 across factors
  value: number; // 0–100
  evidence: string;
}

export interface DealScore {
  total: number; // 0–100
  scoreClass: ScoreClass;
  factors: ScoreFactor[];
  rejectionReasons: string[];
}

// ---------------------------------------------------------------------------
// Fraud / risk
// ---------------------------------------------------------------------------

export interface FraudFlag {
  code: string;
  label: string;
  severity: "INFO" | "WARN" | "HIGH" | "CRITICAL";
  points: number; // contribution to risk score 0–100
  evidence: string;
}

export interface FraudAssessment {
  flags: FraudFlag[];
  riskScore: number; // 0–100 capped
  requiresEnhancedScrutiny: boolean; // extreme bargain or critical flags
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export const WORKFLOW_STAGES = [
  "FOUND",
  "VIN_REQUESTED",
  "VIN_VERIFIED",
  "TITLE_CHECKED",
  "QUESTIONS",
  "INSPECTION",
  "OFFER",
  "PURCHASED",
  "LOST",
  "REJECTED",
] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export interface WorkflowTransition {
  from: WorkflowStage;
  to: WorkflowStage;
  at: string;
  actor: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export interface SearchProfile {
  id?: string;
  name: string;
  zip: string;
  radiusMiles: number;
  make: string | null;
  model: string | null;
  trim: string | null;
  yearMin: number | null;
  yearMax: number | null;
  mileageMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  /** Gate A: max asking/reference ratio. Default 0.70. */
  maxAskingRatio: number;
  requireCleanTitle: boolean;
  /** Only surface/evaluate listings with explicit repair evidence. */
  requireRepairEvidence: boolean;
  allowedRepairCategories: RepairCategory[];
  rejectedRepairCategories: RepairCategory[];
  maxExpectedRepairs: number | null;
  minDealMargin: number;
  maxFraudRiskScore: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export interface AlertRuleConfig {
  minScore: number; // default 85
  maxAskingRatio: number; // default 0.70
  minTitleRank: number; // TITLE_STATE_RANK required, default HISTORY_CLEAN(2)
  minExpectedMargin: number; // dollars
  requireNoMajorMechanicalRisk: boolean; // default true
}

export interface AlertPayload {
  listingId: string;
  headline: string;
  price: number | null;
  referenceValue: number;
  discountPct: number | null;
  expectedRepairs: number;
  allInBasis: number;
  expectedMargin: number;
  titleConfidence: TitleState;
  distanceMiles: number | null;
  score: number;
  scoreClass: ScoreClass;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Outcomes / learning
// ---------------------------------------------------------------------------

export const OUTCOME_TYPES = [
  "PURCHASED",
  "SOLD",
  "UNRESPONSIVE",
  "BAD_TITLE",
  "FAILED_INSPECTION",
  "EXCESSIVE_REPAIRS",
  "SCAM",
  "REJECTED",
  "OTHER",
] as const;
export type OutcomeType = (typeof OUTCOME_TYPES)[number];

export interface PurchaseOutcome {
  actualRepairs: number;
  actualFinishedValue: number | null;
  actualAllIn: number | null;
  actualMargin: number | null;
  soldPrice: number | null;
}

export interface PredictionErrorReport {
  repairsErrorAbs: number;
  repairsErrorPct: number | null;
  finishedValueErrorAbs: number | null;
  allInErrorAbs: number | null;
  marginErrorAbs: number | null;
  direction: "OVERESTIMATED_COST" | "UNDERESTIMATED_COST" | "ON_TARGET";
}

// ---------------------------------------------------------------------------
// Full evaluation
// ---------------------------------------------------------------------------

export interface DealEvaluationInput {
  listing: NormalizedListing;
  profile: SearchProfile;
  valuations: ValuationResult[];
  historyCheck: HistoryCheck | null;
  vinDecode: VinDecodeResult | null;
  userIssues: RepairIssue[]; // manually added/confirmed issues
  transactionCosts: TransactionCostInputs;
  liquidityHint?: { comparableCount: number };
}

export interface DealEvaluation {
  listingId: string;
  evaluatedAt: string;
  formulaVersion: string;
  vinDecode: VinDecodeResult | null;
  titleState: TitleState;
  hardRejected: boolean;
  hardRejectReasons: string[];
  valuation: ValuationBundle;
  repairs: RepairEstimateSummary;
  economics: DealEconomics | null; // null when valuation impossible
  fraud: FraudAssessment;
  score: DealScore;
  suggestedStage: WorkflowStage;
  qualifiesForAlert: boolean;
}
