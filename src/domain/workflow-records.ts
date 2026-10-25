export const INSPECTION_STATUSES = ["SCHEDULED", "IN_PROGRESS", "PASSED", "FAILED", "CANCELLED"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const OFFER_STATUSES = ["DRAFT", "SENT", "COUNTERED", "ACCEPTED", "DECLINED", "EXPIRED"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const INTERACTION_TYPES = ["MESSAGE", "CALL", "MEETING", "QUESTION", "OTHER"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

function normalize<T extends string>(value: string, allowed: readonly T[]): T | null {
  const candidate = value.trim().toUpperCase() as T;
  return allowed.includes(candidate) ? candidate : null;
}

export function normalizeInspectionStatus(value: string): InspectionStatus | null {
  return normalize(value, INSPECTION_STATUSES);
}

export function normalizeOfferStatus(value: string): OfferStatus | null {
  return normalize(value, OFFER_STATUSES);
}

export function normalizeInteractionType(value: string): InteractionType | null {
  return normalize(value, INTERACTION_TYPES);
}
