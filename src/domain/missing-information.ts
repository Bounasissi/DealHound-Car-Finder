import type { HistoryCheck, NormalizedListing, RepairIssue, ValuationResult } from "./types";

export interface MissingInformationItem { code: string; label: string; nextAction: string; severity: "HIGH" | "MEDIUM" | "LOW"; }
export interface MissingInformationResult { items: MissingInformationItem[]; confidence: number; nextAction: string; }

export function missingInformation(listing: NormalizedListing, history: HistoryCheck | null, valuation: ValuationResult | null, issues: RepairIssue[]): MissingInformationResult {
  const items: MissingInformationItem[] = [];
  if (!listing.vin) items.push({ code: "VIN", label: "VIN", nextAction: "Request the 17-digit VIN from the seller.", severity: "HIGH" });
  if (!history) items.push({ code: "TITLE_HISTORY", label: "Title history", nextAction: "Run a history check after receiving the VIN.", severity: "HIGH" });
  if (!listing.vehicle.trim) items.push({ code: "TRIM", label: "Exact trim", nextAction: "Confirm the trim and equipment from the seller or VIN decode.", severity: "MEDIUM" });
  if (!valuation) items.push({ code: "VALUATION", label: "Reference value", nextAction: "Add a KBB Good value or comparable-market valuation.", severity: "HIGH" });
  if (!listing.mileage) items.push({ code: "MILEAGE", label: "Mileage", nextAction: "Confirm the odometer reading and request a photo.", severity: "MEDIUM" });
  if (issues.length === 0) items.push({ code: "REPAIRS", label: "Repair evidence", nextAction: "Add observed repair findings before trusting the margin.", severity: "MEDIUM" });
  const confidence = Math.max(0, Math.min(100, 100 - items.reduce((sum, item) => sum + (item.severity === "HIGH" ? 18 : item.severity === "MEDIUM" ? 10 : 5), 0)));
  return { items, confidence, nextAction: items[0]?.nextAction ?? "Evidence is complete enough for an inspection decision." };
}
