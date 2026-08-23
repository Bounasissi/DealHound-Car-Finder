/**
 * Seller question generation from missing data and detected issues.
 * Questions are prioritized and each carries the reason it matters.
 */
import type { NormalizedListing, RepairIssue, SearchProfile } from "./types";
import { TITLE_STATE_RANK } from "./types";

export interface SellerQuestion {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: "VIN" | "TITLE" | "MECHANICAL" | "HISTORY" | "LOGISTICS" | "SALE_TERMS";
  question: string;
  why: string;
}

export function generateSellerQuestions(
  listing: NormalizedListing,
  issues: RepairIssue[],
  profile: SearchProfile,
  opts: { hasHistoryCheck: boolean; distanceMiles: number | null },
): SellerQuestion[] {
  const q: SellerQuestion[] = [];
  const text = `${listing.title ?? ""} ${listing.description ?? ""}`.toLowerCase();

  // --- VIN -----------------------------------------------------------------
  if (!listing.vin) {
    q.push({
      id: "q-vin",
      priority: "HIGH",
      category: "VIN",
      question: "Could you send me the 17-digit VIN? I can read it off the dashboard or driver's door jamb photo if easier.",
      why: "VIN is required for decode verification and history check before any offer.",
    });
  }

  // --- Title -----------------------------------------------------------------
  const badClaim = listing.titleClaims.some((c) => !c.claimedClean);
  if (listing.titleState === "UNKNOWN" || TITLE_STATE_RANK[listing.titleState] < TITLE_STATE_RANK.SELLER_CLAIMS_CLEAN) {
    q.push({
      id: "q-title-status",
      priority: "HIGH",
      category: "TITLE",
      question: "What is the title status — clean, salvage, rebuilt, or something else? Is the title in your name?",
      why: "Title state drives hard accept/reject rules; seller not on title is a fraud flag.",
    });
  }
  if (badClaim) {
    q.push({
      id: "q-brand-detail",
      priority: "HIGH",
      category: "TITLE",
      question: "The listing mentions a branded/damaged title. Can you share the exact brand and any repair documentation?",
      why: "Brands like salvage/rebuilt/flood are hard rejects unless explicitly overridden.",
    });
  }
  if (/\b(lost|missing|no)\s+title\b/.test(text)) {
    q.push({
      id: "q-lost-title",
      priority: "HIGH",
      category: "TITLE",
      question: "You mentioned the title is lost or missing — has a duplicate been applied for, and when will it be in hand?",
      why: "No title = cannot transfer; treat as high risk until resolved.",
    });
  }

  // --- History ---------------------------------------------------------------
  if (!opts.hasHistoryCheck && listing.vin) {
    q.push({
      id: "q-accidents",
      priority: "MEDIUM",
      category: "HISTORY",
      question: "Any accidents, insurance claims, or insurance-total events in its history? Any open recalls?",
      why: "Cross-checked against the history report once run.",
    });
  }

  // --- Mechanical per detected issue -----------------------------------------
  for (const issue of issues) {
    if (issue.category === "ENGINE_MAJOR" || issue.category === "TRANSMISSION_MAJOR") {
      q.push({
        id: `q-major-${issue.category.toLowerCase()}`,
        priority: "HIGH",
        category: "MECHANICAL",
        question: `Regarding the ${issue.description.toLowerCase()} — when did it start, what diagnosis has been done, and do you have paperwork for any work performed?`,
        why: "Major mechanical risk dominates repair economics; documentation changes the estimate materially.",
      });
    } else if (issue.severity === "HIGH" || issue.severity === "CRITICAL") {
      q.push({
        id: `q-issue-${issue.id}`,
        priority: "MEDIUM",
        category: "MECHANICAL",
        question: `Can you describe the "${issue.description}" situation — symptoms, duration, and any quotes you've received?`,
        why: "Refines low/expected/high repair estimates before inspection.",
      });
    }
  }

  // --- Service records ---------------------------------------------------------
  if (!/\b(service\s+records|maintenance\s+records|receipts)\b/.test(text)) {
    q.push({
      id: "q-records",
      priority: "LOW",
      category: "HISTORY",
      question: "Do you have service records or receipts for maintenance done?",
      why: "Records support immediate-maintenance assumptions and resale story.",
    });
  }

  // --- Sale terms ---------------------------------------------------------------
  if (profile.requireCleanTitle) {
    q.push({
      id: "q-clean-confirm",
      priority: "MEDIUM",
      category: "SALE_TERMS",
      question: "To confirm: the car will be sold with a clean, lien-free title in your name at signing?",
      why: "Locks sale terms against title surprises at handoff.",
    });
  }
  if (opts.distanceMiles !== null && opts.distanceMiles > 100) {
    q.push({
      id: "q-logistics",
      priority: "LOW",
      category: "LOGISTICS",
      question: "Are you able to hold the vehicle with a refundable arrangement while I arrange an inspection and transport?",
      why: "Long-distance deals need explicit holding terms.",
    });
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return q.sort((a, b) => order[a.priority] - order[b.priority]);
}
