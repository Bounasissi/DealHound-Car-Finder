import { describe, expect, it } from "vitest";
import {
  ManualIngestionSource,
  MockInventoryAdapter,
  buildManualListing,
  extractMarketplaceId,
  matchesProfile,
  sourceRegistry,
} from "@/sources";
import { defaultProfile, rawListing } from "./fixtures";

describe("buildManualListing (Facebook Marketplace user-assisted ingestion)", () => {
  it("parses pasted marketplace text into structured fields", () => {
    const raw = buildManualListing({
      pastedText:
        "2014 Honda Accord EX\n$11,500\n123,000 miles\nClean title in hand\nLocated in Mount Laurel, NJ\nNeeds new tires, AC blows warm",
      url: "https://www.facebook.com/marketplace/item/789456123",
    });
    expect(raw.price).toBe(11500);
    expect(raw.mileage).toBe(123000);
    expect(raw.year).toBe(2014);
    expect(raw.make).toBe("honda");
    expect(raw.model).toBe("Accord");
    expect(raw.trim).toBe("EX");
    expect(raw.location).toBe("Mount Laurel, NJ");
    expect(raw.sourceListingId).toBe("789456123");
    expect(raw.sourceKind).toBe("marketplace-screenshot");
  });

  it("explicit user overrides win over parsing", () => {
    const raw = buildManualListing({
      pastedText: "$5,000 obo",
      overrides: { price: 6500 },
    });
    expect(raw.price).toBe(6500);
  });

  it("screenshot notes become analyzed findings", () => {
    const raw = buildManualListing({
      screenshotNotes: ["odometer shows 98k", "check engine light visible"],
    });
    expect(raw.photos![0].analyzedFindings).toContain("check engine light visible");
  });

  it("extracts marketplace item id from URL shapes", () => {
    expect(extractMarketplaceId("https://www.facebook.com/marketplace/item/1234567890")).toBe("1234567890");
    expect(extractMarketplaceId("https://facebook.com/?id=42")).toBe("42");
    expect(extractMarketplaceId(undefined)).toBeUndefined();
  });
});

describe("ManualIngestionSource", () => {
  it("is always configured and never scrapes", async () => {
    const s = new ManualIngestionSource();
    expect(s.isConfigured()).toBe(true);
    const listings = await s.fetchListings(defaultProfile());
    expect(listings).toEqual([]); // deliberate: no scraping
  });
});

describe("MockInventoryAdapter", () => {
  const fixtures = [
    rawListing({ price: 9000, mileage: 90000, year: 2016, make: "toyota", model: "Camry" }),
    rawListing({ price: 20000, mileage: 30000, year: 2020, make: "honda", model: "Accord" }),
    rawListing({ price: 6000, mileage: 180000, year: 2012, make: "ford", model: "Fusion" }),
  ];

  it("serves fixtures when unconfigured and filters by profile", async () => {
    const adapter = new MockInventoryAdapter(null, fixtures);
    expect(adapter.isConfigured()).toBe(false);
    const results = await adapter.fetchListings(
      defaultProfile({ priceMax: 12000, yearMin: 2014, make: "Toyota" }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].model).toBe("Camry");
  });

  it("throws a clear error when credentials exist but adapter not wired", async () => {
    const adapter = new MockInventoryAdapter({ baseUrl: "https://api.example.com", apiKey: "k" }, fixtures);
    expect(adapter.isConfigured()).toBe(true);
    await expect(adapter.fetchListings(defaultProfile())).rejects.toThrow(/not wired/);
  });
});

describe("sourceRegistry", () => {
  it("registers manual source by default and supports extension", () => {
    expect(sourceRegistry.get("facebook-marketplace-manual")).toBeDefined();
    class FakeSource extends ManualIngestionSource {
      readonly id = "craigslist-authorized" as never;
    }
    sourceRegistry.register(new FakeSource());
    expect(sourceRegistry.get("craigslist-authorized")).toBeDefined();
    expect(sourceRegistry.list().length).toBeGreaterThanOrEqual(2);
  });
});

describe("matchesProfile", () => {
  it("enforces all profile bounds", () => {
    const l = rawListing({ price: 9500, mileage: 98000, year: 2016, make: "toyota", model: "Camry LE" });
    expect(matchesProfile(l, defaultProfile({ priceMin: 9000, priceMax: 10000 }))).toBe(true);
    expect(matchesProfile(l, defaultProfile({ priceMax: 9000 }))).toBe(false);
    expect(matchesProfile(l, defaultProfile({ mileageMax: 90000 }))).toBe(false);
    expect(matchesProfile(l, defaultProfile({ yearMin: 2017 }))).toBe(false);
    expect(matchesProfile(l, defaultProfile({ make: "Honda" }))).toBe(false);
    expect(matchesProfile(l, defaultProfile({ model: "Accord" }))).toBe(false);
  });
});
