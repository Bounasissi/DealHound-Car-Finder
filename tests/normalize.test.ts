import { describe, expect, it } from "vitest";
import { computeDedupKey, mergeIntoExisting, normalizeListing, sourceListingIdentity } from "@/domain/normalize";
import { VIN_CAMRY, rawListing } from "./fixtures";

describe("normalizeListing", () => {
  it("fills derived fields: claims, issues, dedup key, timestamps", () => {
    const n = normalizeListing(
      rawListing({
        description: "Clean title. Needs tires and AC repair. $9,500 firm.",
      }),
    );
    expect(n.titleClaims.length).toBeGreaterThan(0);
    expect(n.parsedIssues.map((i) => i.category)).toContain("TIRES_BRAKES");
    expect(n.dedupKey).toMatch(/^vin:/);
    expect(n.priceHistory).toHaveLength(1);
    expect(n.titleState).toBe("SELLER_CLAIMS_CLEAN");
    expect(n.vinConfidence).toBe("PROVIDED_UNVERIFIED");
  });

  it("extracts VIN from text when not explicit", () => {
    const n = normalizeListing(rawListing({ vin: undefined, description: `vin ${VIN_CAMRY.toLowerCase()} call me` }));
    expect(n.vin).toBe(VIN_CAMRY);
  });
});

describe("computeDedupKey", () => {
  it("keeps a stable source identity when mutable listing facts change", () => {
    const a = normalizeListing(rawListing({ sourceListingId: "marketplace-123", mileage: 98000 }));
    const b = normalizeListing(rawListing({ sourceListingId: "marketplace-123", mileage: 101000, location: "Cherry Hill, NJ" }));
    expect(sourceListingIdentity(a)).toBe("facebook-marketplace-manual:marketplace-123");
    expect(sourceListingIdentity(a)).toBe(sourceListingIdentity(b));
  });

  it("VIN key is canonical", () => {
    expect(computeDedupKey(VIN_CAMRY, { year: null, make: null, model: null, mileage: null, location: null })).toBe(`vin:${VIN_CAMRY}`);
  });

  it("attribute fallback is stable across re-listings with same facts", () => {
    const a = computeDedupKey(null, { year: 2016, make: "Toyota", model: "Camry", mileage: 98000, location: "Mount Laurel, NJ" });
    const b = computeDedupKey(null, { year: 2016, make: "toyota", model: "camry", mileage: 98400, location: "mount laurel nj" });
    expect(a).toBe(b); // mileage bucketed to 1k; case/punctuation normalized
  });

  it("different vehicles produce different keys", () => {
    const a = computeDedupKey(null, { year: 2016, make: "Toyota", model: "Camry", mileage: 98000, location: "X" });
    const b = computeDedupKey(null, { year: 2015, make: "Honda", model: "Accord", mileage: 98000, location: "X" });
    expect(a).not.toBe(b);
  });
});

describe("mergeIntoExisting", () => {
  it("appends price history on price change and refreshes lastSeen", () => {
    const existing = normalizeListing(rawListing());
    const incoming = normalizeListing(rawListing({ price: 9000 }));
    incoming.lastSeenAt = "2026-08-23T10:00:00.000Z";
    const { merged, changedFields } = mergeIntoExisting(existing, incoming);
    expect(changedFields).toContain("price");
    expect(merged.price).toBe(9000);
    expect(merged.priceHistory).toHaveLength(2);
    expect(merged.lastSeenAt).toBe("2026-08-23T10:00:00.000Z");
    expect(merged.firstSeenAt).toBe(existing.firstSeenAt);
  });

  it("adopts VIN when learned later and upgrades dedup key", () => {
    const existing = normalizeListing(rawListing({ vin: undefined }));
    const incoming = normalizeListing(rawListing());
    const { merged, changedFields } = mergeIntoExisting(existing, incoming);
    expect(changedFields).toContain("vin");
    expect(merged.vin).toBe(VIN_CAMRY);
    expect(merged.dedupKey).toBe(`vin:${VIN_CAMRY}`);
  });

  it("identifies pure duplicates (no changes)", () => {
    const existing = normalizeListing(rawListing());
    const incoming = normalizeListing(rawListing());
    const { isDuplicate } = mergeIntoExisting(existing, incoming);
    expect(isDuplicate).toBe(true);
  });

  it("unions title claims without duplicating", () => {
    const existing = normalizeListing(rawListing());
    const incoming = normalizeListing(rawListing());
    const { merged } = mergeIntoExisting(existing, incoming);
    expect(merged.titleClaims).toHaveLength(existing.titleClaims.length);
  });
});
