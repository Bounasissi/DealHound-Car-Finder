import { describe, expect, it } from "vitest";
import {
  MarketCheckFsboSource,
  ManualIngestionSource,
  type ListingSource,
  buildManualListing,
  extractMarketplaceId,
  matchesProfile,
  parseCsvListings,
  sourceRegistry,
} from "@/sources";
import type { RawListing, SearchProfile } from "@/domain/types";
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

describe("MarketCheckFsboSource", () => {
  it("queries private-party inventory with profile and clean-title filters", async () => {
    let requestedUrl = "";
    const source = new MarketCheckFsboSource(
      { apiKey: "marketcheck-test-key", source: "facebook.com" },
      async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({
          listings: [
            {
              id: "mc-1",
              vin: "1HGCM82633A004352",
              heading: "2014 Honda Accord EX needs tires",
              price: 6200,
              miles: 118000,
              vdp_url: "https://www.facebook.com/marketplace/item/123",
              source: "facebook.com",
              seller_type: "fsbo",
              first_seen_at_source_date: "2026-08-22",
              build: { year: 2014, make: "Honda", model: "Accord", trim: "EX" },
              dist: 18,
            },
          ],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    );

    const listings = await source.fetchListings(defaultProfile({
      zip: "08054",
      radiusMiles: 75,
      make: "Honda",
      model: "Accord",
      yearMin: 2012,
      yearMax: 2018,
      mileageMax: 160000,
    }));

    const params = new URL(requestedUrl).searchParams;
    expect(source.isConfigured()).toBe(true);
    expect(params.get("zip")).toBe("08054");
    expect(params.get("radius")).toBe("75");
    expect(params.get("make")).toBe("Honda");
    expect(params.get("model")).toBe("Accord");
    expect(params.get("year_range")).toBe("2012-2018");
    expect(params.get("miles_range")).toBe("0-160000");
    expect(params.get("carfax_clean_title")).toBe("true");
    expect(params.get("source")).toBe("facebook.com");
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      sourceId: "marketcheck-fsbo",
      sourceKind: "inventory-api",
      sourceListingId: "mc-1",
      url: "https://www.facebook.com/marketplace/item/123",
      price: 6200,
      mileage: 118000,
      year: 2014,
      make: "Honda",
      model: "Accord",
    });
  });

  it("stays disabled without an API key and reports provider errors", async () => {
    const disabled = new MarketCheckFsboSource({ apiKey: "" }, async () => new Response("{}", { status: 200 }));
    expect(disabled.isConfigured()).toBe(false);

    const failing = new MarketCheckFsboSource({ apiKey: "key" }, async () => new Response("nope", { status: 401 }));
    await expect(failing.fetchListings(defaultProfile())).rejects.toThrow(/MarketCheck returned HTTP 401/);
  });
});

describe("test-only inventory fixture adapter", () => {
  const fixtures = [
    rawListing({ price: 9000, mileage: 90000, year: 2016, make: "toyota", model: "Camry" }),
    rawListing({ price: 20000, mileage: 30000, year: 2020, make: "honda", model: "Accord" }),
    rawListing({ price: 6000, mileage: 180000, year: 2012, make: "ford", model: "Fusion" }),
  ];

  class TestFixtureAdapter implements ListingSource {
    readonly id = "test-fixture";
    readonly label = "test fixture";
    readonly kind = "inventory-api" as const;
    constructor(private config: { baseUrl: string; apiKey: string } | null, private rows: RawListing[]) {}
    isConfigured() { return this.config !== null && this.config.apiKey.length > 0; }
    async fetchListings(profile: SearchProfile) {
      if (this.isConfigured()) throw new Error("Live inventory API not wired; test fixture cannot make network calls");
      return this.rows.filter((f) => matchesProfile(f, profile));
    }
  }

  it("serves fixtures when unconfigured and filters by profile", async () => {
    const adapter = new TestFixtureAdapter(null, fixtures);
    expect(adapter.isConfigured()).toBe(false);
    const results = await adapter.fetchListings(
      defaultProfile({ priceMax: 12000, yearMin: 2014, make: "Toyota" }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].model).toBe("Camry");
  });

  it("throws a clear error when credentials exist but adapter not wired", async () => {
    const adapter = new TestFixtureAdapter({ baseUrl: "https://api.example.com", apiKey: "k" }, fixtures);
    expect(adapter.isConfigured()).toBe(true);
    await expect(adapter.fetchListings(defaultProfile())).rejects.toThrow(/not wired/);
  });
});

describe("free import paths", () => {
  it("parses a user-provided CSV without network access", () => {
    const rows = parseCsvListings('title,price,kbbGoodValue,mileage,year,make,model,location\n"2015 Honda Accord",11500,15500,98000,2015,Honda,Accord,"Mount Laurel, NJ"');
    expect(rows).toHaveLength(1);
    expect(rows[0].overrides?.price).toBe(11500);
    expect(rows[0].kbbGoodValue).toBe(15500);
    expect(rows[0].overrides?.location).toBe("Mount Laurel, NJ");
  });

  it("ignores out-of-range CSV reference values instead of persisting them", () => {
    const rows = parseCsvListings("title,price,kbbGoodValue\nHonda Accord,8000,99");
    expect(rows[0].kbbGoodValue).toBeUndefined();
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

  it("enforces trim when a profile specifies one", () => {
    const l = rawListing({ trim: "LE" });
    expect(matchesProfile(l, defaultProfile({ trim: "LE" }))).toBe(true);
    expect(matchesProfile(l, defaultProfile({ trim: "XSE" }))).toBe(false);
  });
});
