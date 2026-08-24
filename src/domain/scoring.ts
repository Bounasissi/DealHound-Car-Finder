/**
 * Explainable 0–100 deal score with weighted factors and rejection reasons.
 * Every factor carries its evidence so decisions are auditable.
 */
import type {
  DealEconomics,
  DealScore,
  FraudAssessment,
  RepairEstimateSummary,
  ScoreClass,
  ScoreFactor,
  SearchProfile,
  TitleState,
  VinConfidence,
} from "./types";
import { isAuthoritativeCleanTitle } from "./title";

export const DEAL_SCORE_FORMULA_VERSION = "deal-score-v1";

export interface ScoringInput {
  economics: DealEconomics | null;
  repairs: RepairEstimateSummary;
  titleState: TitleState;
  requireCleanTitle: boolean;
  vinConfidence: VinConfidence;
  fraud: FraudAssessment;
  profile: SearchProfile;
  liquidity: { comparableCount: number };
  distanceMiles: number | null;
  hasSellerContact: boolean;
}

const WEIGHTS = {
  discount: 25,
  postRepairEconomics: 25,
  titleHistory: 15,
  repairRisk: 15,
  liquidity: 10,
  sellerListingConfidence: 5,
  logistics: 5,
} as const;

export function classifyScore(total: number): ScoreClass {
  if (total >= 90) return "EXCEPTIONAL";
  if (total >= 80) return "STRONG_BUY";
  if (total >= 70) return "INVESTIGATE";
  if (total >= 50) return "HIGH_RISK";
  return "REJECT";
}

export function computeDealScore(input: ScoringInput): DealScore {
  const { economics, repairs, titleState, requireCleanTitle, vinConfidence, fraud, profile, liquidity, distanceMiles, hasSellerContact } =
    input;

  const factors: ScoreFactor[] = [];
  const rejectionReasons: string[] = [];

  // --- Hard rejects first -------------------------------------------------
  if (repairs.rejectedCategories.length > 0) {
    rejectionReasons.push(`Rejected repair categories present: ${repairs.rejectedCategories.join(", ")}`);
  }
  if (fraud.riskScore > profile.maxFraudRiskScore) {
    rejectionReasons.push(`Fraud risk ${fraud.riskScore} exceeds max allowed ${profile.maxFraudRiskScore}`);
  }
  for (const f of fraud.flags) {
    if (f.severity === "CRITICAL") rejectionReasons.push(`Critical fraud flag: ${f.label}`);
  }
  if (requireCleanTitle && !isAuthoritativeCleanTitle(titleState)) {
    rejectionReasons.push(
      `Clean title required but state is ${titleState} (needs HISTORY_CLEAN or better)`,
    );
  }
  if (profile.maxExpectedRepairs !== null && repairs.totalExpected > profile.maxExpectedRepairs) {
    rejectionReasons.push(
      `Expected repairs $${repairs.totalExpected.toLocaleString()} exceed max $${profile.maxExpectedRepairs!.toLocaleString()}`,
    );
  }
  if (repairs.unknownCosts) rejectionReasons.push(`Repair costs unknown: ${repairs.unknownReason}`);

  // --- Factor: discount (asking vs reference) ------------------------------
  let discountValue = 0;
  if (economics) {
    const ratio = economics.askingRatio;
    // 1.00 → 0 pts; 0.70 → 75 pts; <=0.50 → 100 pts. Linear below 0.70.
    discountValue = ratio >= 1 ? 0 : ratio >= 0.7 ? ((1 - ratio) / 0.3) * 75 : Math.min(100, 75 + ((0.7 - ratio) / 0.2) * 25);
    factors.push({
      key: "discount",
      label: "Discount to reference value",
      weight: WEIGHTS.discount,
      value: Math.round(discountValue),
      evidence: `Asking ratio ${ratio} vs reference $${economics.referenceGoodValue.toLocaleString()}`,
    });
  } else {
    factors.push({
      key: "discount", label: "Discount to reference value", weight: WEIGHTS.discount, value: 0,
      evidence: "No credible valuation available",
    });
    rejectionReasons.push("No credible reference valuation available");
  }

  // --- Factor: post-repair economics --------------------------------------
  let econValue = 0;
  if (economics) {
    const r = economics.expectedAllInToValueRatio;
    // Piecewise curve. Conservatism is already enforced by Gate B and the
    // finished-value haircut, so this factor grades position on the curve
    // rather than double-punishing: ≤0.45→100; 0.60→90; 0.70→70; 0.85→45.
    econValue =
      r <= 0.45 ? 100
      : r <= 0.6 ? 90 + ((0.6 - r) / 0.15) * 10
      : r <= 0.7 ? 70 + ((0.7 - r) / 0.1) * 20
      : r <= 0.85 ? 45 + ((0.85 - r) / 0.25) * 25
      : Math.max(0, 45 - (r - 0.85) * 240);
    factors.push({
      key: "postRepairEconomics",
      label: "Post-repair economics (all-in vs finished value)",
      weight: WEIGHTS.postRepairEconomics,
      value: Math.round(econValue),
      evidence: `Expected all-in/value ${r}; expected margin $${economics.expectedMargin.toLocaleString()} (${economics.expectedMarginPct}%)`,
    });
    if (!economics.gateA.passed)
      rejectionReasons.push(`Gate A failed: ${economics.gateA.detail}`);
    if (!economics.gateB.passed)
      rejectionReasons.push(`Gate B failed: ${economics.gateB.detail}`);
    if (economics.expectedMargin < profile.minDealMargin) {
      rejectionReasons.push(
        `Expected margin $${economics.expectedMargin.toLocaleString()} below minimum $${profile.minDealMargin.toLocaleString()}`,
      );
    }
  } else {
    factors.push({
      key: "postRepairEconomics", label: "Post-repair economics", weight: WEIGHTS.postRepairEconomics, value: 0,
      evidence: "Cannot compute without valuation",
    });
  }

  // --- Factor: title/history ----------------------------------------------
  const titleValueByState: Record<TitleState, number> = {
    UNKNOWN: 0,
    SELLER_CLAIMS_CLEAN: 35,
    HISTORY_CLEAN: 70,
    DOCUMENT_REVIEWED: 50,
    VERIFIED: 100,
  };
  const titleValue = titleValueByState[titleState];
  factors.push({
    key: "titleHistory", label: "Title & history confidence", weight: WEIGHTS.titleHistory,
    value: titleValue, evidence: `Title state ${titleState}`,
  });

  // --- Factor: repair risk -------------------------------------------------
  const majorCount = repairs.issues.filter((i) => i.majorRisk).length;
  const highSevCount = repairs.issues.filter((i) => i.severity === "HIGH" || i.severity === "CRITICAL").length;
  const repairRiskRaw = 100
    - majorCount * 30
    - highSevCount * 10
    - Math.min(15, repairs.totalExpected / 1000);
  factors.push({
    key: "repairRisk", label: "Repair risk", weight: WEIGHTS.repairRisk,
    value: clamp(repairRiskRaw),
    evidence: `${repairs.issues.length} issue(s), ${majorCount} major-risk, expected repairs $${repairs.totalExpected.toLocaleString()} (range $${repairs.totalLow.toLocaleString()}–$${repairs.totalHigh.toLocaleString()})`,
  });

  // --- Factor: liquidity ----------------------------------------------------
  const compCount = liquidity.comparableCount;
  const liquidityValue = compCount >= 10 ? 90 : compCount >= 5 ? 75 : compCount >= 3 ? 60 : compCount >= 1 ? 40 : 25;
  factors.push({
    key: "liquidity", label: "Liquidity (resale demand)", weight: WEIGHTS.liquidity,
    value: liquidityValue, evidence: `${compCount} comparable listing(s) observed`,
  });

  // --- Factor: seller/listing confidence -----------------------------------
  let sellerValue = 60;
  const sellerEvidence: string[] = [];
  if (vinConfidence === "DECODED_MATCH") { sellerValue += 20; sellerEvidence.push("VIN decoded & matches"); }
  else if (vinConfidence === "DECODED_MISMATCH") { sellerValue -= 40; sellerEvidence.push("VIN mismatch"); }
  else if (vinConfidence === "NONE") { sellerValue -= 15; sellerEvidence.push("no VIN provided"); }
  if (hasSellerContact) { sellerValue += 10; sellerEvidence.push("seller contact available"); }
  else sellerEvidence.push("no seller contact");
  if (input.fraud.requiresEnhancedScrutiny) { sellerValue -= 20; sellerEvidence.push("enhanced scrutiny required"); }
  factors.push({
    key: "sellerListingConfidence", label: "Seller & listing confidence", weight: WEIGHTS.sellerListingConfidence,
    value: clamp(sellerValue), evidence: sellerEvidence.join("; ") || "baseline",
  });

  // --- Factor: logistics -----------------------------------------------------
  let logisticsValue = 70;
  if (distanceMiles !== null) {
    logisticsValue = distanceMiles <= 25 ? 95 : distanceMiles <= 50 ? 85 : distanceMiles <= 150 ? 65 : distanceMiles <= 400 ? 45 : 25;
  }
  factors.push({
    key: "logistics", label: "Logistics (distance/transport)", weight: WEIGHTS.logistics,
    value: logisticsValue,
    evidence: distanceMiles !== null ? `${distanceMiles} miles from ZIP` : "distance unknown",
  });

  const total = Math.round(
    factors.reduce((s, f) => s + f.value * f.weight, 0) / factors.reduce((s, f) => s + f.weight, 0),
  );

  return {
    total,
    scoreClass: classifyScore(total),
    factors,
    rejectionReasons: [...new Set(rejectionReasons)],
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
