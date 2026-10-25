/**
 * Fraud & risk detection. Flags are evidence-based with explicit points;
 * extreme bargains automatically require enhanced scrutiny.
 */
import type { AppConfig } from "./config";
import type { FraudAssessment, FraudFlag, NormalizedListing, ValuationBundle } from "./types";

const SCAM_LANGUAGE: Array<{ re: RegExp; label: string }> = [
  { re: /\b(zelle|venmo|cash\s*app|cashapp|wire\s+transfer|western\s+union|money\s+gram)\b/i, label: "irreversible payment method requested" },
  { re: /\bdeposit\s+(to\s+)?(hold|reserve|secure)\b/i, label: "deposit requested to hold vehicle" },
  { re: /\b(ebay\s+motors\s+protection|buyer\s+protection\s+plan)\b/i, label: "fake buyer-protection program referenced" },
  { re: /\b(shipping\s+only|will\s+ship\s+the\s+car|can'?t\s+meet\s+in\s+person|currently\s+overseas|stationed\s+(in|overseas)|military\s+deployment)\b/i, label: "remote/shipping-only sale language" },
  { re: /\b(urgent(ly)?\s+sale?|must\s+sell\s+(today|asap|now)|moving\s+tomorrow|price\s+firm\s+today\s+only)\b/i, label: "artificial urgency language" },
  { re: /\b(cash\s+only.*no\s+test\s+drive|no\s+questions|serious\s+buyers?\s+only.*deposit)\b/i, label: "control-oriented sale conditions" },
];

export interface FraudInput {
  listing: NormalizedListing;
  valuation: ValuationBundle;
  vinMismatch: boolean;
  duplicateCount: number; // other active listings with same dedup key
  config: AppConfig;
}

export function assessFraud(input: FraudInput): FraudAssessment {
  const { listing, valuation, vinMismatch, duplicateCount, config } = input;
  const flags: FraudFlag[] = [];
  const text = `${listing.title ?? ""} ${listing.description ?? ""} ${listing.rawText ?? ""}`;

  const add = (code: string, label: string, severity: FraudFlag["severity"], points: number, evidence: string) =>
    flags.push({ code, label, severity, points, evidence });

  // Deposits before viewing
  if (/\bdeposit\b/i.test(text)) {
    add("DEPOSIT_BEFORE_VIEWING", "Deposit requested before in-person viewing", "HIGH", 20,
      "Listing or seller messages mention a deposit.");
  }

  // Shipping-only sales
  if (/\b(ship|deliver(ed|y)?\s+only|freight)\b/i.test(text) && !/\b(local\s+pickup|in\s+person)\b/i.test(text)) {
    add("SHIPPING_ONLY", "Shipping-only sale pattern", "HIGH", 20,
      "Sale appears to be remote-only with no local pickup.");
  }

  // VIN mismatch
  if (vinMismatch) {
    add("VIN_MISMATCH", "VIN does not match listed vehicle", "CRITICAL", 40,
      "Decoded VIN attributes conflict with listing details.");
  }

  // Refusal / absence of VIN on request stage
  if (!listing.vin && listing.sourceKind !== "inventory-api") {
    add("NO_VIN_PROVIDED", "Seller has not provided VIN", "WARN", 8,
      "No VIN in listing; must be requested before title check.");
  }

  // Seller not named on title (claim-level signal)
  if (/\b(title\s+is\s+in\s+(my\s+)?(mom|dad|wife|husband|brother|sister|friend|grandma|grandpa)'?s?\s+name|not\s+in\s+my\s+name|lost\s+title|no\s+title)\b/i.test(text)) {
    add("SELLER_NOT_ON_TITLE", "Seller may not be the titled owner", "HIGH", 25,
      "Listing suggests title is in another name or missing.");
  }

  // Extreme pricing — too good to be true
  if (valuation.askingRatio !== null && valuation.askingRatio < config.extremeBargainRatio) {
    add("EXTREME_BARGAIN", "Price far below market requires enhanced scrutiny", "WARN", 10,
      `Asking ratio ${valuation.askingRatio} below scrutiny threshold ${config.extremeBargainRatio}.`);
  }

  // Duplicate listings
  if (duplicateCount > 0) {
    add("DUPLICATE_LISTING", "Same vehicle advertised multiple times", "WARN", 12,
      `${duplicateCount} other active listing(s) share this dedup key.`);
  }

  // Location inconsistencies (ZIP vs stated city mismatch heuristics)
  if (listing.location && /\b(out\s+of\s+state|different\s+state|can\s+meet\s+halfway)\b/i.test(text)) {
    add("LOCATION_INCONSISTENCY", "Location ambiguity in sale terms", "INFO", 6,
      "Listing references out-of-state or meet-halfway arrangements.");
  }

  // Scam language
  for (const p of SCAM_LANGUAGE) {
    if (p.re.test(text)) {
      add("SCAM_LANGUAGE", `Scam indicator: ${p.label}`, "HIGH", 18,
        `Matched pattern: ${p.label}.`);
      break; // one scam-language flag is enough; details retained in evidence
    }
  }

  const rawScore = flags.reduce((s, f) => s + f.points, 0);
  const riskScore = Math.min(100, rawScore);
  const requiresEnhancedScrutiny =
    flags.some((f) => f.severity === "CRITICAL") ||
    flags.some((f) => f.code === "EXTREME_BARGAIN");

  return { flags, riskScore, requiresEnhancedScrutiny };
}
