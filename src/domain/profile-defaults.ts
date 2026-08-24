import type { SearchProfile } from "./types";

/** Sensible baseline profile used when none is configured. */
export function defaultProfile(overrides: Partial<SearchProfile> = {}): SearchProfile {
  return {
    name: "Default — clean title, ≤70% of reference",
    zip: "08054",
    radiusMiles: 100,
    make: null,
    model: null,
    trim: null,
    yearMin: null,
    yearMax: null,
    mileageMax: null,
    priceMin: null,
    priceMax: null,
    maxAskingRatio: 0.7,
    requireKbbReference: true,
    maxAllInRatio: 0.8,
    requireCleanTitle: true,
    requireRepairEvidence: true,
    allowedRepairCategories: [],
    rejectedRepairCategories: ["ENGINE_MAJOR", "TRANSMISSION_MAJOR", "RUST_FRAME_FLOOD_FIRE"],
    maxExpectedRepairs: null,
    minDealMargin: 2000,
    maxFraudRiskScore: 40,
    active: true,
    ...overrides,
  };
}
