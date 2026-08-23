import type {
  DealEvaluationInput,
  HistoryCheck,
  NormalizedListing,
  SearchProfile,
  ValuationResult,
} from "@/domain/types";
import { normalizeListing } from "@/domain/normalize";
import type { RawListing } from "@/domain/types";

/** Known-valid VIN (2003 Honda Accord EX V6). */
export const VIN_ACCORD = "1HGCM82633A004352";
/** Valid per ISO 3779 check-digit (Camry-shaped test VIN). */
export const VIN_CAMRY = "4T1BF1FK5FU009306";

export function defaultProfile(overrides: Partial<SearchProfile> = {}): SearchProfile {
  return {
    id: "profile-1",
    name: "Test Profile",
    zip: "08054",
    radiusMiles: 75,
    make: null,
    model: null,
    trim: null,
    yearMin: null,
    yearMax: null,
    mileageMax: null,
    priceMin: null,
    priceMax: null,
    maxAskingRatio: 0.7,
    requireCleanTitle: true,
    allowedRepairCategories: [],
    rejectedRepairCategories: ["ENGINE_MAJOR", "TRANSMISSION_MAJOR", "RUST_FRAME_FLOOD_FIRE"],
    maxExpectedRepairs: null,
    minDealMargin: 2000,
    maxFraudRiskScore: 40,
    active: true,
    ...overrides,
  };
}

export function rawListing(overrides: Partial<RawListing> = {}): RawListing {
  return {
    sourceId: "facebook-marketplace-manual",
    sourceKind: "marketplace-screenshot",
    title: "2016 Toyota Camry LE",
    description:
      "Selling my 2016 Toyota Camry LE. Runs good, needs new tires and brakes soon. Clean title in hand, 98k miles. $9,500.",
    price: 9500,
    mileage: 98000,
    location: "Mount Laurel, NJ",
    vin: VIN_CAMRY,
    year: 2016,
    make: "toyota",
    model: "Camry",
    trim: "LE",
    sellerName: "Mike",
    sellerType: "private",
    sellerContact: "(555) 010-2030",
    postedAt: "2026-08-20T14:00:00.000Z",
    ...overrides,
  };
}

export function normalizedListing(overrides: Partial<RawListing> = {}): NormalizedListing {
  return normalizeListing(rawListing(overrides));
}

export function manualValuation(referenceGoodValue: number, provider = "manual-kbb-entry"): ValuationResult {
  return {
    provider,
    referenceGoodValue,
    compMedian: null,
    compRange: null,
    confidence: 0.85,
    notes: "test fixture",
    computedAt: "2026-08-22T12:00:00.000Z",
  };
}

export function cleanHistory(vin: string): HistoryCheck {
  return {
    provider: "nmvtis-mock",
    vin,
    titleState: "HISTORY_CLEAN",
    brands: [],
    accidentCount: 0,
    odometerReadings: [45000, 70000, 98000],
    checkedAt: "2026-08-22T12:00:00.000Z",
  };
}

export function salvageHistory(vin: string): HistoryCheck {
  return {
    provider: "nmvtis-mock",
    vin,
    titleState: "HISTORY_CLEAN",
    brands: ["SALVAGE"],
    accidentCount: 2,
    odometerReadings: [90000],
    checkedAt: "2026-08-22T12:00:00.000Z",
  };
}

export function evalInput(overrides: Partial<DealEvaluationInput> = {}): DealEvaluationInput {
  const listing = overrides.listing ?? normalizedListing();
  return {
    listing,
    profile: defaultProfile(),
    valuations: [manualValuation(15000)],
    historyCheck: cleanHistory(listing.vin ?? VIN_CAMRY),
    vinDecode: null,
    userIssues: [],
    transactionCosts: { taxTitleFeeRate: 0.08, inspectionFee: 200, transportationCost: 150 },
    liquidityHint: { comparableCount: 6 },
    ...overrides,
  };
}
