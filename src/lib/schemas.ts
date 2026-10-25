/** Zod schemas for all API inputs — typed at the boundary. */
import { z } from "zod";
import { REPAIR_CATEGORIES } from "@/domain/types";

export const profileInput = z.object({
  name: z.string().min(1).max(120),
  zip: z.string().regex(/^\d{5}$/, "ZIP must be 5 digits"),
  radiusMiles: z.number().int().min(1).max(2000).default(100),
  make: z.string().nullable().optional().default(null),
  model: z.string().nullable().optional().default(null),
  trim: z.string().nullable().optional().default(null),
  yearMin: z.number().int().min(1950).max(2035).nullable().optional().default(null),
  yearMax: z.number().int().min(1950).max(2035).nullable().optional().default(null),
  mileageMax: z.number().int().min(0).max(1_000_000).nullable().optional().default(null),
  priceMin: z.number().min(0).nullable().optional().default(null),
  priceMax: z.number().min(0).nullable().optional().default(null),
  maxAskingRatio: z.number().min(0.1).max(1).default(0.7),
  requireKbbReference: z.boolean().default(true),
  maxAllInRatio: z.number().min(0.1).max(1.5).default(0.8),
  requireCleanTitle: z.boolean().default(true),
  requireRepairEvidence: z.boolean().default(true),
  allowedRepairCategories: z.array(z.enum(REPAIR_CATEGORIES)).default([]),
  rejectedRepairCategories: z.array(z.enum(REPAIR_CATEGORIES)).default([]),
  maxExpectedRepairs: z.number().min(0).nullable().optional().default(null),
  minDealMargin: z.number().min(0).default(2000),
  maxFraudRiskScore: z.number().int().min(0).max(100).default(40),
  active: z.boolean().default(true),
});
export const profileUpdate = profileInput.partial();
export type ProfileInput = z.infer<typeof profileInput>;

export const manualIngestInput = z.object({
  pastedText: z.string().max(20_000).optional(),
  url: z.string().url().optional(),
  kbbGoodValue: z.number().min(100).max(1_000_000).optional(),
  screenshotNotes: z.array(z.string().max(500)).max(20).optional(),
  photoNotes: z.array(z.string().max(500)).max(20).optional(),
  overrides: z
    .object({
      title: z.string().max(200).optional(),
      price: z.number().min(100).max(500_000).optional(),
      mileage: z.number().int().min(0).max(1_000_000).optional(),
      location: z.string().max(120).optional(),
      vin: z.string().length(17).optional(),
      year: z.number().int().min(1950).max(2035).optional(),
      make: z.string().max(40).optional(),
      model: z.string().max(80).optional(),
      trim: z.string().max(60).optional(),
      sellerName: z.string().max(120).optional(),
      sellerContact: z.string().max(120).optional(),
    })
    .optional(),
});

export const csvImportInput = z.object({
  csv: z.string().min(1).max(2_000_000),
});

export const allowlistedUrlImportInput = z.object({
  url: z.string().url(),
});

export const titleVerificationInput = z.object({
  state: z.enum(["UNKNOWN", "SELLER_CLAIMS_CLEAN", "DOCUMENT_REVIEWED"]),
  evidenceNote: z.string().min(3).max(1000),
});

export const valuationInput = z.object({
  provider: z.enum(["manual-kbb-entry", "comps", "licensed-kbb", "marketcheck-price"]),
  referenceGoodValue: z.number().min(100).max(1_000_000).optional(),
  comps: z
    .array(
      z.object({
        price: z.number().min(100).max(1_000_000),
        mileage: z.number().int().min(0).nullable().optional(),
        year: z.number().int().min(1950).max(2035).nullable().optional(),
        source: z.string().max(60).default("manual"),
        observedAt: z.string().optional(),
      }),
    )
    .optional(),
  notes: z.string().max(500).optional(),
});

export const workflowInput = z.object({
  to: z.enum([
    "FOUND", "VIN_REQUESTED", "VIN_VERIFIED", "TITLE_CHECKED",
    "QUESTIONS", "INSPECTION", "OFFER", "PURCHASED", "LOST", "REJECTED",
  ]),
  note: z.string().max(500).optional(),
});

export const outcomeInput = z.object({
  outcome: z.enum([
    "PURCHASED", "SOLD", "UNRESPONSIVE", "BAD_TITLE", "FAILED_INSPECTION",
    "EXCESSIVE_REPAIRS", "SCAM", "REJECTED", "OTHER",
  ]),
  notes: z.string().max(2000).optional(),
  purchase: z
    .object({
      actualRepairs: z.number().min(0),
      actualFinishedValue: z.number().min(0).nullable().optional(),
      actualAllIn: z.number().min(0).nullable().optional(),
      actualMargin: z.number().nullable().optional(),
      soldPrice: z.number().min(0).nullable().optional(),
    })
    .optional(),
});

export const inspectionInput = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "PASSED", "FAILED", "CANCELLED"]),
  scheduledAt: z.string().datetime().nullable().optional(),
  findings: z.array(z.string().min(1).max(500)).max(100).default([]),
  notes: z.string().max(2000).optional(),
});

export const offerInput = z.object({
  amount: z.number().positive().max(1_000_000),
  status: z.enum(["DRAFT", "SENT", "COUNTERED", "ACCEPTED", "DECLINED", "EXPIRED"]).default("DRAFT"),
  notes: z.string().max(2000).optional(),
  respondedAt: z.string().datetime().nullable().optional(),
});

export const interactionInput = z.object({
  type: z.enum(["MESSAGE", "CALL", "MEETING", "QUESTION", "OTHER"]),
  body: z.string().min(1).max(4000),
  occurredAt: z.string().datetime().optional(),
});

export const listingPatchInput = z.object({
  watched: z.boolean().optional(),
  notes: z.string().max(4000).optional(),
  vin: z.string().length(17).nullable().optional(),
  sellerContact: z.string().max(120).nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  mileage: z.number().int().min(0).nullable().optional(),
});

export const userIssueInput = z.object({
  category: z.enum(REPAIR_CATEGORIES),
  description: z.string().min(3).max(300),
  severity: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]).default("MODERATE"),
  estimateExpected: z.number().min(0).max(100_000),
  majorRisk: z.boolean().default(false),
});
