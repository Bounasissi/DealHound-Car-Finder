/**
 * Listing normalization + deduplication.
 * Converts RawListing (any source) into NormalizedListing with derived fields:
 * title claims, parsed issues, red-flag seeds, dedup key, timestamps.
 */
import { createHash } from "node:crypto";
import { parseIssuesFromText } from "./repairs";
import { deriveTitleState, parseTitleClaims } from "./title";
import { TITLE_STATE_RANK, type NormalizedListing, type RawListing } from "./types";
import { extractVin } from "./vin";
import { emptyAttributes } from "./vin";

export function normalizeListing(raw: RawListing, now = new Date()): NormalizedListing {
  const ts = now.toISOString();
  const fullText = `${raw.title ?? ""}\n${raw.description ?? ""}\n${raw.rawText ?? ""}`;

  const vin = raw.vin ? raw.vin.trim().toUpperCase() : extractVin(fullText);
  const titleClaims = [
    ...(raw.titleClaims ?? []),
    ...parseTitleClaims(fullText, "LISTING_TEXT"),
  ];
  const parsedIssues = parseIssuesFromText(fullText);

  return {
    sourceId: raw.sourceId,
    sourceKind: raw.sourceKind,
    sourceListingId: raw.sourceListingId,
    url: raw.url,
    rawText: raw.rawText,
    title: raw.title,
    description: raw.description,
    price: raw.price ?? null,
    priceHistory: raw.priceHistory ?? (raw.price ? [{ price: raw.price, at: ts }] : []),
    mileage: raw.mileage ?? null,
    location: raw.location ?? null,
    vin: vin ?? null,
    vinConfidence: vin ? "PROVIDED_UNVERIFIED" : "NONE",
    vehicle: {
      year: raw.year ?? null,
      make: raw.make ?? null,
      model: raw.model ?? null,
      trim: raw.trim ?? null,
      bodyClass: null,
      fuelType: null,
      engineCylinders: null,
    },
    sellerName: raw.sellerName ?? null,
    sellerType: raw.sellerType ?? "unknown",
    sellerContact: raw.sellerContact ?? null,
    photos: raw.photos ?? [],
    titleClaims,
    titleState: deriveTitleState(titleClaims, null),
    parsedIssues,
    redFlags: [],
    postedAt: raw.postedAt ?? ts,
    firstSeenAt: ts,
    lastSeenAt: ts,
    dedupKey: computeDedupKey(vin ?? null, {
      year: raw.year ?? null,
      make: raw.make ?? null,
      model: raw.model ?? null,
      mileage: raw.mileage ?? null,
      location: raw.location ?? null,
    }),
  };
}

/**
 * Dedup key: VIN when available (canonical), else a stable hash of
 * year/make/model/mileage/location. Same vehicle posted twice collides.
 */
export function computeDedupKey(
  vin: string | null,
  fallback: { year: number | null; make: string | null; model: string | null; mileage: number | null; location: string | null },
): string {
  if (vin) return `vin:${vin}`;
  const parts = [
    fallback.year ?? "?",
    (fallback.make ?? "?").toLowerCase(),
    (fallback.model ?? "?").toLowerCase(),
    fallback.mileage !== null ? String(Math.round(fallback.mileage / 1000)) : "?", // 1k-mile bucket
    (fallback.location ?? "?").toLowerCase().replace(/[^a-z0-9]/g, ""),
  ].join("|");
  return `attr:${createHash("sha256").update(parts).digest("hex").slice(0, 16)}`;
}

export interface MergeResult {
  merged: NormalizedListing;
  changedFields: string[];
  isDuplicate: boolean;
}

/**
 * Merge an incoming normalized listing into an existing one:
 * updates price history, refreshes lastSeen, keeps earliest firstSeen.
 */
export function mergeIntoExisting(existing: NormalizedListing, incoming: NormalizedListing): MergeResult {
  const changed: string[] = [];
  const merged: NormalizedListing = { ...existing };

  if (incoming.price !== null && incoming.price !== existing.price) {
    merged.price = incoming.price;
    merged.priceHistory = [
      ...existing.priceHistory,
      ...(incoming.price
        ? [{ price: incoming.price, at: incoming.lastSeenAt, note: "re-observed" }]
        : []),
    ];
    changed.push("price");
  }
  if (incoming.vin && !existing.vin) {
    merged.vin = incoming.vin;
    merged.vinConfidence = incoming.vinConfidence;
    merged.dedupKey = incoming.dedupKey;
    changed.push("vin");
  }
  for (const field of ["mileage", "location", "description", "title"] as const) {
    if (incoming[field] && incoming[field] !== existing[field]) {
      // @ts-expect-error dynamic assignment across union field types is safe here
      merged[field] = incoming[field];
      changed.push(field);
    }
  }
  if (incoming.sellerContact && !existing.sellerContact) {
    merged.sellerContact = incoming.sellerContact;
    changed.push("sellerContact");
  }

  // Union claims/issues/flags/photos
  const claimSet = new Set(existing.titleClaims.map((c) => `${c.claim}:${c.source}`));
  for (const c of incoming.titleClaims) {
    if (!claimSet.has(`${c.claim}:${c.source}`)) merged.titleClaims.push(c);
  }
  const issueSet = new Set(existing.parsedIssues.map((i) => i.category));
  for (const i of incoming.parsedIssues) {
    if (!issueSet.has(i.category)) merged.parsedIssues.push(i);
  }
  const flagSet = new Set(existing.redFlags.map((f) => f.code));
  for (const f of incoming.redFlags) {
    if (!flagSet.has(f.code)) merged.redFlags.push(f);
  }
  if (incoming.photos.length > existing.photos.length) merged.photos = incoming.photos;

  const derivedTitleState = deriveTitleState(merged.titleClaims, null);
  if (TITLE_STATE_RANK[derivedTitleState] > TITLE_STATE_RANK[merged.titleState]) {
    merged.titleState = derivedTitleState;
  }
  merged.lastSeenAt = incoming.lastSeenAt;

  return { merged, changedFields: changed, isDuplicate: changed.length === 0 };
}
