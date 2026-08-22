/**
 * Title state machine + hard-reject brand logic.
 * Seller claims never advance past SELLER_CLAIMS_CLEAN.
 */
import { HARD_REJECT_BRANDS, TITLE_STATE_RANK, type HardRejectBrand, type HistoryCheck, type TitleClaim, type TitleState } from "./types";

const CLAIM_PATTERNS: Array<{ re: RegExp; clean: boolean; claim: string }> = [
  { re: /\bclean\s+title\b/i, clean: true, claim: "clean title" },
  { re: /\btitle\s+in\s+hand\b/i, clean: true, claim: "title in hand" },
  { re: /\bclear\s+title\b/i, clean: true, claim: "clear title" },
  { re: /\bsalvage\b/i, clean: false, claim: "salvage title" },
  { re: /\brebuilt\b/i, clean: false, claim: "rebuilt title" },
  { re: /\bflood\b/i, clean: false, claim: "flood history" },
  { re: /\bwater\s+damage\b/i, clean: false, claim: "water damage" },
  { re: /\bjunk(ing)?\s+title\b/i, clean: false, claim: "junk title" },
  { re: /\bparts\s+only\b/i, clean: false, claim: "parts only" },
  { re: /\bcertificate\s+of\s+destruction\b/i, clean: false, claim: "certificate of destruction" },
  { re: /\bnon-?op\b/i, clean: false, claim: "non-op" },
  { re: /\blien\b/i, clean: false, claim: "lien mentioned" },
  { re: /\bbranded\b/i, clean: false, claim: "branded title" },
];

/** Parse title claims from free text. Claims are recorded, never trusted. */
export function parseTitleClaims(text: string, source: TitleClaim["source"] = "LISTING_TEXT"): TitleClaim[] {
  const now = new Date().toISOString();
  const out: TitleClaim[] = [];
  for (const p of CLAIM_PATTERNS) {
    const m = text.match(p.re);
    if (m) out.push({ claim: p.claim, claimedClean: p.clean, source, capturedAt: now });
  }
  return out;
}

/**
 * Derive the current title state from available evidence.
 * Order of authority: history check > seller claims > unknown.
 */
export function deriveTitleState(claims: TitleClaim[], history: HistoryCheck | null): TitleState {
  if (history) return history.titleState;
  const hasCleanClaim = claims.some((c) => c.claimedClean);
  const hasBadClaim = claims.some((c) => !c.claimedClean);
  if (hasCleanClaim && !hasBadClaim) return "SELLER_CLAIMS_CLEAN";
  if (hasBadClaim) return "SELLER_CLAIMS_CLEAN"; // still just a claim; bad claims surface as flags/rejects
  return "UNKNOWN";
}

/** Map history-provider brands to our normalized brand codes. */
export function normalizeBrands(rawBrands: string[]): string[] {
  const out: string[] = [];
  for (const b of rawBrands) {
    const s = b.toUpperCase();
    if (s.includes("SALVAGE")) out.push("SALVAGE");
    else if (s.includes("REBUILT") || s.includes("REBUILDABLE")) out.push("REBUILT");
    else if (s.includes("FLOOD") || s.includes("WATER")) out.push("FLOOD");
    else if (s.includes("JUNK")) out.push("JUNK");
    else if (s.includes("PARTS")) out.push("PARTS_ONLY");
    else if (s.includes("DESTRUCTION")) out.push("CERTIFICATE_OF_DESTRUCTION");
    else out.push(s.replace(/\s+/g, "_"));
  }
  return [...new Set(out)];
}

export interface HardRejectResult {
  rejected: boolean;
  reasons: string[];
}

/**
 * Hard rejects: salvage, rebuilt, flood, junk/parts-only, certificate of destruction,
 * VIN mismatch, or any configured severe brand. `allowedBrands` lets a user override
 * specific brands (e.g., accept rebuilt) — explicit, auditable override.
 */
export function evaluateHardRejects(
  history: HistoryCheck | null,
  claims: TitleClaim[],
  vinMismatch: boolean,
  allowedBrands: string[] = [],
): HardRejectResult {
  const reasons: string[] = [];
  const allowed = new Set(allowedBrands.map((b) => b.toUpperCase()));

  if (vinMismatch) reasons.push("VIN mismatch between listing and decoded vehicle");

  const brands = history ? normalizeBrands(history.brands) : [];
  for (const brand of brands) {
    if (HARD_REJECT_BRANDS.includes(brand as HardRejectBrand) && !allowed.has(brand)) {
      reasons.push(`Severe title brand: ${brand}`);
    }
  }

  // Bad claims without a history check are strong signals, not verified rejects —
  // they block clean-title requirement instead of hard-rejecting.
  return { rejected: reasons.length > 0, reasons };
}

/** Does this listing satisfy the profile's clean-title requirement? */
export function satisfiesCleanTitleRequirement(state: TitleState, requireClean: boolean): boolean {
  if (!requireClean) return true;
  return TITLE_STATE_RANK[state] >= TITLE_STATE_RANK.HISTORY_CLEAN;
}
