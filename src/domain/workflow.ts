/**
 * Deal workflow state machine.
 * FOUND → VIN_REQUESTED → VIN_VERIFIED → TITLE_CHECKED → QUESTIONS → INSPECTION → OFFER → PURCHASED/LOST/REJECTED
 */
import type { NormalizedListing, WorkflowStage } from "./types";
import { TITLE_STATE_RANK } from "./types";

const FORWARD_ORDER: WorkflowStage[] = [
  "FOUND",
  "VIN_REQUESTED",
  "VIN_VERIFIED",
  "TITLE_CHECKED",
  "QUESTIONS",
  "INSPECTION",
  "OFFER",
  "PURCHASED",
];

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

export function canTransition(
  from: WorkflowStage,
  to: WorkflowStage,
  listing: Pick<NormalizedListing, "vin" | "titleState">,
): TransitionCheck {
  // Terminal states
  if (from === "PURCHASED") return { allowed: false, reason: "Deal already purchased (terminal)" };
  if (from === "REJECTED") return { allowed: false, reason: "Listing rejected (terminal)" };
  if (from === "LOST" && to !== "FOUND") return { allowed: false, reason: "Lost deals can only be re-found" };

  // REJECTED reachable from any active stage; LOST from QUESTIONS onward (unresponsive seller)
  if (to === "REJECTED") return { allowed: true };
  if (to === "LOST") {
    const fromIdx = FORWARD_ORDER.indexOf(from);
    return fromIdx >= FORWARD_ORDER.indexOf("QUESTIONS")
      ? { allowed: true }
      : { allowed: false, reason: "LOST applies from QUESTIONS onward (e.g., unresponsive seller)" };
  }

  // Forward-only progression through the pipeline
  const fromIdx = FORWARD_ORDER.indexOf(from);
  const toIdx = FORWARD_ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return { allowed: false, reason: `Unknown stage transition ${from} → ${to}` };
  if (toIdx !== fromIdx + 1) {
    return { allowed: false, reason: `Forward flow requires sequential stages (${from} → ${to} skips steps)` };
  }

  // Stage guards
  if (to === "VIN_VERIFIED" && !listing.vin) {
    return { allowed: false, reason: "Cannot verify workflow VIN without a VIN on the listing" };
  }
  if (to === "TITLE_CHECKED" && TITLE_STATE_RANK[listing.titleState] < TITLE_STATE_RANK.HISTORY_CLEAN) {
    return {
      allowed: false,
      reason: `Title check requires HISTORY_CLEAN or better (current: ${listing.titleState}). Run history provider first.`,
    };
  }
  return { allowed: true };
}

/** Suggest the next logical stage given current evidence. */
export function suggestStage(
  listing: Pick<NormalizedListing, "vin" | "vinConfidence" | "titleState">,
  opts: { hasHistoryCheck: boolean },
): WorkflowStage {
  if (!listing.vin) return "VIN_REQUESTED";
  if (!opts.hasHistoryCheck) return listing.titleState === "UNKNOWN" ? "VIN_VERIFIED" : "VIN_VERIFIED";
  if (TITLE_STATE_RANK[listing.titleState] < TITLE_STATE_RANK.DOCUMENT_REVIEWED) return "TITLE_CHECKED";
  return "QUESTIONS";
}
