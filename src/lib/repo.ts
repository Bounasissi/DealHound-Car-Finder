/**
 * Data access bridging Drizzle rows ↔ domain objects.
 * All numeric() columns are strings in/out of the driver; converted here so
 * the rest of the app works in plain numbers.
 */
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  alerts,
  evaluations,
  historyChecks,
  listings,
  outcomes,
  searchProfiles,
  userIssues,
  valuations,
  vinCache,
} from "@/db/schema";
import { computeDedupKey, mergeIntoExisting, normalizeListing } from "@/domain/normalize";
import type { OutcomeRecord } from "@/domain/learning";
import type {
  DealEvaluation,
  HistoryCheck,
  NormalizedListing,
  RepairCategory,
  RepairIssue,
  SearchProfile,
  TitleState,
  ValuationResult,
  VinConfidence,
  VinDecodeResult,
  WorkflowStage,
} from "@/domain/types";

// --- converters -------------------------------------------------------------

type ListingRow = typeof listings.$inferSelect;

export function rowToNormalizedListing(row: ListingRow): NormalizedListing {
  return {
    id: row.id,
    sourceId: row.sourceId,
    sourceKind: row.sourceKind as NormalizedListing["sourceKind"],
    sourceListingId: row.sourceListingId ?? undefined,
    url: row.url ?? undefined,
    rawText: row.rawText ?? undefined,
    title: row.title ?? undefined,
    description: row.description ?? undefined,
    price: row.price ? Number(row.price) : null,
    priceHistory: row.priceHistory,
    mileage: row.mileage ?? null,
    location: row.location ?? null,
    vin: row.vin ?? null,
    vinConfidence: row.vinConfidence as VinConfidence,
    vehicle: {
      year: row.vehicleYear ?? null,
      make: row.vehicleMake ?? null,
      model: row.vehicleModel ?? null,
      trim: row.vehicleTrim ?? null,
      bodyClass: null,
      fuelType: null,
      engineCylinders: null,
    },
    sellerName: row.sellerName ?? null,
    sellerType: row.sellerType as NormalizedListing["sellerType"],
    sellerContact: row.sellerContact ?? null,
    photos: row.photos,
    titleClaims: row.titleClaims as NormalizedListing["titleClaims"],
    titleState: row.titleState as TitleState,
    parsedIssues: row.parsedIssues as NormalizedListing["parsedIssues"],
    redFlags: row.redFlags,
    postedAt: row.postedAt?.toISOString() ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    dedupKey: row.dedupKey,
    workflowStage: row.workflowStage as WorkflowStage,
  };
}

function listingToRowValues(n: NormalizedListing) {
  return {
    sourceId: n.sourceId,
    sourceKind: n.sourceKind,
    sourceListingId: n.sourceListingId ?? null,
    url: n.url ?? null,
    rawText: n.rawText ?? null,
    title: n.title ?? null,
    description: n.description ?? null,
    price: n.price !== null ? String(n.price) : null,
    priceHistory: n.priceHistory,
    mileage: n.mileage,
    location: n.location,
    vin: n.vin,
    vinConfidence: n.vinConfidence,
    vehicleYear: n.vehicle.year,
    vehicleMake: n.vehicle.make,
    vehicleModel: n.vehicle.model,
    vehicleTrim: n.vehicle.trim,
    sellerName: n.sellerName,
    sellerType: n.sellerType,
    sellerContact: n.sellerContact,
    photos: n.photos,
    titleClaims: n.titleClaims,
    titleState: n.titleState,
    parsedIssues: n.parsedIssues,
    redFlags: n.redFlags,
    postedAt: n.postedAt ? new Date(n.postedAt) : null,
    firstSeenAt: new Date(n.firstSeenAt),
    lastSeenAt: new Date(n.lastSeenAt),
    dedupKey: n.dedupKey,
  };
}

export function profileRowToDomain(row: typeof searchProfiles.$inferSelect): SearchProfile {
  return {
    id: row.id,
    name: row.name,
    zip: row.zip,
    radiusMiles: row.radiusMiles,
    make: row.make,
    model: row.model,
    trim: row.trim,
    yearMin: row.yearMin,
    yearMax: row.yearMax,
    mileageMax: row.mileageMax,
    priceMin: row.priceMin !== null ? Number(row.priceMin) : null,
    priceMax: row.priceMax !== null ? Number(row.priceMax) : null,
    maxAskingRatio: Number(row.maxAskingRatio),
    requireCleanTitle: row.requireCleanTitle,
    allowedRepairCategories: row.allowedRepairCategories as RepairCategory[],
    rejectedRepairCategories: row.rejectedRepairCategories as RepairCategory[],
    maxExpectedRepairs: row.maxExpectedRepairs !== null ? Number(row.maxExpectedRepairs) : null,
    minDealMargin: Number(row.minDealMargin),
    maxFraudRiskScore: row.maxFraudRiskScore,
    active: row.active,
  };
}

// --- profiles -----------------------------------------------------------------

export async function listProfiles(activeOnly = false): Promise<SearchProfile[]> {
  const rows = activeOnly
    ? await db.select().from(searchProfiles).where(eq(searchProfiles.active, true))
    : await db.select().from(searchProfiles);
  return rows.map(profileRowToDomain);
}

export async function getProfile(id: string): Promise<SearchProfile | null> {
  const [row] = await db.select().from(searchProfiles).where(eq(searchProfiles.id, id));
  return row ? profileRowToDomain(row) : null;
}

export async function createProfile(p: SearchProfile): Promise<SearchProfile> {
  const [row] = await db
    .insert(searchProfiles)
    .values({
      name: p.name,
      zip: p.zip,
      radiusMiles: p.radiusMiles,
      make: p.make,
      model: p.model,
      trim: p.trim,
      yearMin: p.yearMin,
      yearMax: p.yearMax,
      mileageMax: p.mileageMax,
      priceMin: p.priceMin !== null ? String(p.priceMin) : null,
      priceMax: p.priceMax !== null ? String(p.priceMax) : null,
      maxAskingRatio: String(p.maxAskingRatio),
      requireCleanTitle: p.requireCleanTitle,
      allowedRepairCategories: p.allowedRepairCategories,
      rejectedRepairCategories: p.rejectedRepairCategories,
      maxExpectedRepairs: p.maxExpectedRepairs !== null ? String(p.maxExpectedRepairs) : null,
      minDealMargin: String(p.minDealMargin),
      maxFraudRiskScore: p.maxFraudRiskScore,
      active: p.active,
    })
    .returning();
  return profileRowToDomain(row);
}

export async function deleteProfile(id: string): Promise<void> {
  await db.delete(searchProfiles).where(eq(searchProfiles.id, id));
}

// --- listings -------------------------------------------------------------------

export async function listListings(opts: { watched?: boolean; stage?: string } = {}): Promise<NormalizedListing[]> {
  const conditions = [];
  if (opts.watched !== undefined) conditions.push(eq(listings.watched, opts.watched));
  if (opts.stage) conditions.push(eq(listings.workflowStage, opts.stage));
  const rows = conditions.length
    ? await db.select().from(listings).where(and(...conditions)).orderBy(desc(listings.lastSeenAt))
    : await db.select().from(listings).orderBy(desc(listings.lastSeenAt));
  return rows.map(rowToNormalizedListing);
}

export async function getListing(id: string): Promise<NormalizedListing | null> {
  const [row] = await db.select().from(listings).where(eq(listings.id, id));
  return row ? rowToNormalizedListing(row) : null;
}

/** Dedup-aware insert/update. Returns { listing, created, mergedFields }. */
export async function upsertListing(
  incoming: NormalizedListing,
): Promise<{ listing: NormalizedListing; created: boolean; mergedFields: string[] }> {
  const [existingRow] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.dedupKey, incoming.dedupKey), ne(listings.workflowStage, "REJECTED")));

  if (!existingRow) {
    const [row] = await db.insert(listings).values(listingToRowValues(incoming)).returning();
    return { listing: rowToNormalizedListing(row), created: true, mergedFields: [] };
  }

  const existing = rowToNormalizedListing(existingRow);
  const { merged, changedFields } = mergeIntoExisting(existing, incoming);
  await db
    .update(listings)
    .set({ ...listingToRowValues(merged), updatedAt: new Date() })
    .where(eq(listings.id, existingRow.id));
  return { listing: merged, created: false, mergedFields: changedFields };
}

export async function countDuplicates(dedupKey: string, excludeId?: string): Promise<number> {
  const rows = excludeId
    ? await db.select({ id: listings.id }).from(listings).where(and(eq(listings.dedupKey, dedupKey), ne(listings.id, excludeId)))
    : await db.select({ id: listings.id }).from(listings).where(eq(listings.dedupKey, dedupKey));
  return rows.length;
}

export interface ListingPatch {
  watched?: boolean;
  notes?: string;
  vin?: string | null;
  sellerContact?: string | null;
  price?: number | null;
  mileage?: number | null;
  workflowStage?: WorkflowStage;
  workflowTransition?: { from: string; to: string; at: string; actor: string; note?: string };
  titleState?: TitleState;
  vinConfidence?: VinConfidence;
}

export async function patchListing(id: string, patch: ListingPatch): Promise<NormalizedListing | null> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.watched !== undefined) set.watched = patch.watched;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.vin !== undefined) set.vin = patch.vin;
  if (patch.sellerContact !== undefined) set.sellerContact = patch.sellerContact;
  if (patch.price !== undefined) {
    set.price = patch.price !== null ? String(patch.price) : null;
    // Track price change history when the row already exists.
    const [current] = await db.select().from(listings).where(eq(listings.id, id));
    if (current && patch.price !== null && Number(current.price) !== patch.price) {
      set.priceHistory = [
        ...(current.priceHistory ?? []),
        { price: patch.price, at: new Date().toISOString(), note: "manual update" },
      ];
    }
  }
  if (patch.mileage !== undefined) set.mileage = patch.mileage;
  if (patch.workflowStage !== undefined) set.workflowStage = patch.workflowStage;
  if (patch.workflowTransition !== undefined) {
    const [current] = await db.select().from(listings).where(eq(listings.id, id));
    set.workflowHistory = [...(current?.workflowHistory ?? []), patch.workflowTransition];
  }
  if (patch.titleState !== undefined) set.titleState = patch.titleState;
  if (patch.vinConfidence !== undefined) set.vinConfidence = patch.vinConfidence;

  const [row] = await db.update(listings).set(set).where(eq(listings.id, id)).returning();
  return row ? rowToNormalizedListing(row) : null;
}

// --- valuations ------------------------------------------------------------------

export async function addValuation(listingId: string, v: ValuationResult): Promise<void> {
  await db.insert(valuations).values({
    listingId,
    provider: v.provider,
    referenceGoodValue: String(v.referenceGoodValue),
    compMedian: v.compMedian !== null ? String(v.compMedian) : null,
    compRangeLow: v.compRange ? String(v.compRange[0]) : null,
    compRangeHigh: v.compRange ? String(v.compRange[1]) : null,
    confidence: String(v.confidence),
    notes: v.notes,
  });
}

export async function listValuations(listingId: string): Promise<ValuationResult[]> {
  const rows = await db
    .select()
    .from(valuations)
    .where(eq(valuations.listingId, listingId))
    .orderBy(desc(valuations.createdAt));
  return rows.map((r) => ({
    provider: r.provider,
    referenceGoodValue: Number(r.referenceGoodValue),
    compMedian: r.compMedian !== null ? Number(r.compMedian) : null,
    compRange:
      r.compRangeLow !== null && r.compRangeHigh !== null
        ? [Number(r.compRangeLow), Number(r.compRangeHigh)]
        : null,
    confidence: Number(r.confidence),
    notes: r.notes ?? "",
    computedAt: r.createdAt.toISOString(),
  }));
}

// --- history checks ---------------------------------------------------------------

export async function addHistoryCheck(listingId: string, h: HistoryCheck): Promise<void> {
  await db.insert(historyChecks).values({
    listingId,
    provider: h.provider,
    vin: h.vin,
    titleState: h.titleState,
    brands: h.brands,
    accidentCount: h.accidentCount,
    odometerReadings: h.odometerReadings,
    raw: h.raw ?? null,
    checkedAt: new Date(h.checkedAt),
  });
}

export async function latestHistoryCheck(listingId: string): Promise<HistoryCheck | null> {
  const [row] = await db
    .select()
    .from(historyChecks)
    .where(eq(historyChecks.listingId, listingId))
    .orderBy(desc(historyChecks.checkedAt));
  if (!row) return null;
  return {
    provider: row.provider,
    vin: row.vin,
    titleState: row.titleState as TitleState,
    brands: row.brands,
    accidentCount: row.accidentCount,
    odometerReadings: row.odometerReadings,
    checkedAt: row.checkedAt.toISOString(),
  };
}

// --- user issues --------------------------------------------------------------------

export async function addUserIssue(listingId: string, issue: RepairIssue): Promise<void> {
  await db.insert(userIssues).values({
    listingId,
    category: issue.category,
    description: issue.description,
    severity: issue.severity,
    confidence: String(issue.confidence),
    estimateLow: String(issue.estimateLow),
    estimateExpected: String(issue.estimateExpected),
    estimateHigh: String(issue.estimateHigh),
    majorRisk: issue.majorRisk,
    source: issue.source,
  });
}

export async function listUserIssues(listingId: string): Promise<RepairIssue[]> {
  const rows = await db.select().from(userIssues).where(eq(userIssues.listingId, listingId));
  return rows.map((r) => ({
    id: r.id,
    category: r.category as RepairCategory,
    description: r.description,
    severity: r.severity as RepairIssue["severity"],
    confidence: Number(r.confidence),
    estimateLow: Number(r.estimateLow),
    estimateExpected: Number(r.estimateExpected),
    estimateHigh: Number(r.estimateHigh),
    majorRisk: r.majorRisk,
    source: r.source as RepairIssue["source"],
  }));
}

// --- evaluations ------------------------------------------------------------------------

export async function saveEvaluation(
  listingId: string,
  profileId: string | null,
  evaluation: DealEvaluation,
): Promise<string> {
  const [row] = await db
    .insert(evaluations)
    .values({
      listingId,
      profileId,
      score: evaluation.score.total,
      scoreClass: evaluation.score.scoreClass,
      askingRatio: evaluation.economics?.askingRatio != null ? String(evaluation.economics.askingRatio) : null,
      gateAPassed: evaluation.economics?.gateA.passed ?? null,
      gateBPassed: evaluation.economics?.gateB.passed ?? null,
      expectedMargin: evaluation.economics ? String(evaluation.economics.expectedMargin) : null,
      fraudRiskScore: evaluation.fraud.riskScore,
      hardRejected: evaluation.hardRejected,
      payload: evaluation,
    })
    .returning({ id: evaluations.id });
  return row.id;
}

export async function latestEvaluation(listingId: string): Promise<DealEvaluation | null> {
  const [row] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.listingId, listingId))
    .orderBy(desc(evaluations.createdAt));
  return row ? (row.payload as DealEvaluation) : null;
}

// --- alerts ---------------------------------------------------------------------------------

export async function saveAlert(listingId: string, evaluationId: string, payload: unknown): Promise<void> {
  await db.insert(alerts).values({ listingId, evaluationId, payload });
}

export async function listAlerts(): Promise<Array<{ id: string; listingId: string; payload: unknown; createdAt: Date }>> {
  return db.select().from(alerts).orderBy(desc(alerts.createdAt));
}

// --- outcomes -----------------------------------------------------------------------------------

export async function recordOutcome(record: OutcomeRecord & { evaluationId?: string | null }): Promise<void> {
  await db.insert(outcomes).values({
    listingId: record.listingId,
    evaluationId: record.evaluationId ?? null,
    outcome: record.outcome,
    notes: record.notes ?? null,
    actualRepairs: record.purchase?.actualRepairs !== undefined ? String(record.purchase.actualRepairs) : null,
    actualFinishedValue:
      record.purchase?.actualFinishedValue != null ? String(record.purchase.actualFinishedValue) : null,
    actualAllIn: record.purchase?.actualAllIn != null ? String(record.purchase.actualAllIn) : null,
    actualMargin: record.purchase?.actualMargin != null ? String(record.purchase.actualMargin) : null,
    soldPrice: record.purchase?.soldPrice != null ? String(record.purchase.soldPrice) : null,
    predictionError: record.predictionError ?? null,
    recordedAt: new Date(record.recordedAt),
  });
}

export async function listOutcomes(): Promise<Array<{ id: string; listingId: string; outcome: string; predictionError: unknown; recordedAt: Date }>> {
  return db.select().from(outcomes).orderBy(desc(outcomes.recordedAt));
}

// --- VIN cache --------------------------------------------------------------------------------------

export async function getCachedVin(vin: string): Promise<VinDecodeResult | null> {
  const [row] = await db.select().from(vinCache).where(eq(vinCache.vin, vin));
  return row ? (row.decoded as VinDecodeResult) : null;
}

export async function setCachedVin(vin: string, decoded: VinDecodeResult): Promise<void> {
  await db
    .insert(vinCache)
    .values({ vin, decoded, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: vinCache.vin, set: { decoded, fetchedAt: new Date() } });
}

// re-export for service use
export { normalizeListing, computeDedupKey };
