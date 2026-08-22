/**
 * Provider-neutral listing source abstraction.
 *
 * Implementations:
 *  - ManualIngestionSource: Facebook Marketplace user-assisted ingestion
 *    (screenshots/copied text/URLs). No scraping — the user supplies content.
 *  - MockInventoryAdapter: production-shaped stand-in for a licensed inventory
 *    feed; activates real adapters by registering them in the registry.
 *
 * Extensibility: authorized Craigslist/OfferUp/auction adapters implement the
 * same interface and register themselves — no core changes required.
 */
import { parseListingText } from "@/lib/parser";
import type { ListingSourceKind, RawListing, SearchProfile } from "@/domain/types";

export interface ListingSource {
  /** Stable source id used on every listing from this source. */
  readonly id: string;
  readonly label: string;
  readonly kind: ListingSourceKind;
  /** True when credentials/config for this source are present. */
  isConfigured(): boolean;
  /** Fetch listings matching a profile. Manual sources return [] and rely on ingest(). */
  fetchListings(profile: SearchProfile): Promise<RawListing[]>;
}

// ---------------------------------------------------------------------------
// Manual ingestion (Facebook Marketplace user-assisted flow)
// ---------------------------------------------------------------------------

export interface ManualIngestInput {
  pastedText?: string;
  url?: string;
  screenshotNotes?: string[];
  photoNotes?: string[];
  overrides?: Partial<RawListing>;
}

/**
 * Builds a RawListing from user-supplied Marketplace content.
 * Parses what it can from text; explicit user fields always win over parsing.
 */
export function buildManualListing(input: ManualIngestInput): RawListing {
  const text = input.pastedText ?? "";
  const parsed = parseListingText(text);
  const o = input.overrides ?? {};

  const raw: RawListing = {
    sourceId: "facebook-marketplace-manual",
    sourceKind: "marketplace-screenshot",
    sourceListingId: o.sourceListingId ?? extractMarketplaceId(input.url),
    url: input.url,
    rawText: text || undefined,
    title: o.title ?? firstLine(text) ?? undefined,
    description: o.description ?? (text ? text.slice(0, 2000) : undefined),
    price: o.price ?? parsed.price ?? undefined,
    mileage: o.mileage ?? parsed.mileage ?? undefined,
    location: o.location ?? parsed.location ?? undefined,
    vin: o.vin ?? parsed.vin ?? undefined,
    year: o.year ?? parsed.year ?? undefined,
    make: o.make ?? parsed.make ?? undefined,
    model: o.model ?? parsed.model ?? undefined,
    trim: o.trim ?? parsed.trim ?? undefined,
    sellerName: o.sellerName ?? parsed.sellerName ?? undefined,
    sellerType: o.sellerType ?? "private",
    sellerContact: o.sellerContact,
    photos: [
      ...(input.photoNotes ?? []).map((note) => ({ note })),
      ...(o.photos ?? []),
    ],
    postedAt: o.postedAt,
    priceHistory: o.priceHistory,
  };

  // Screenshot observations become analyzed findings on the first photo entry.
  if (input.screenshotNotes?.length) {
    raw.photos = [
      { url: input.url, note: "marketplace screenshot", analyzedFindings: input.screenshotNotes },
      ...raw.photos!,
    ];
  }
  return raw;
}

function firstLine(text: string): string | undefined {
  const line = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  return line?.slice(0, 140);
}

/** Extract marketplace item id from common URL shapes. */
export function extractMarketplaceId(url?: string): string | undefined {
  if (!url) return undefined;
  const m = url.match(/marketplace\/item\/(\d+)/) ?? url.match(/[?&]id=(\d+)/);
  return m ? m[1] : undefined;
}

export class ManualIngestionSource implements ListingSource {
  readonly id = "facebook-marketplace-manual";
  readonly label = "Facebook Marketplace (user-assisted ingestion)";
  readonly kind = "marketplace-screenshot" as const;
  isConfigured() { return true; } // always available; user supplies content
  async fetchListings(_profile: SearchProfile): Promise<RawListing[]> {
    // Deliberately no scraping. Ingestion happens via buildManualListing().
    void _profile;
    return [];
  }
}

// ---------------------------------------------------------------------------
// Production-shaped mock inventory adapter
// ---------------------------------------------------------------------------

export interface InventoryApiConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Mirrors the shape of a licensed dealer-inventory API (e.g., a paid listings
 * feed). When credentials exist it would call `GET /listings?zip=&radius=...`;
 * without credentials it serves deterministic fixture data so the full
 * pipeline is exercisable end-to-end. Clearly labeled MOCK at runtime.
 */
export class MockInventoryAdapter implements ListingSource {
  readonly id = "inventory-api-mock";
  readonly label = "Licensed inventory feed (MOCK)";
  readonly kind = "inventory-api" as const;

  constructor(private config: InventoryApiConfig | null, private fixtures: RawListing[]) {}

  isConfigured(): boolean {
    return this.config !== null && this.config.apiKey.length > 0;
  }

  async fetchListings(profile: SearchProfile): Promise<RawListing[]> {
    if (this.isConfigured()) {
      // Real adapter call site — kept explicit so wiring a licensed feed is a
      // single implementation change, not an architecture change.
      // return this.http.get(`${config.baseUrl}/listings`, { params: toQuery(profile) });
      throw new Error("Live inventory API not wired; provide adapter implementation");
    }
    return this.fixtures.filter((f) => matchesProfile(f, profile));
  }
}

export function matchesProfile(listing: RawListing, p: SearchProfile): boolean {
  if (p.priceMin !== null && (listing.price ?? 0) < p.priceMin) return false;
  if (p.priceMax !== null && (listing.price ?? Infinity) > p.priceMax) return false;
  if (p.mileageMax !== null && (listing.mileage ?? Infinity) > p.mileageMax) return false;
  if (p.yearMin !== null && (listing.year ?? 0) < p.yearMin) return false;
  if (p.yearMax !== null && (listing.year ?? 9999) > p.yearMax) return false;
  if (p.make && (listing.make ?? "").toLowerCase() !== p.make.toLowerCase()) return false;
  if (p.model && !(listing.model ?? "").toLowerCase().includes(p.model.toLowerCase())) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

class SourceRegistry {
  private sources = new Map<string, ListingSource>();

  register(source: ListingSource): void {
    this.sources.set(source.id, source);
  }

  get(id: string): ListingSource | undefined {
    return this.sources.get(id);
  }

  list(): ListingSource[] {
    return [...this.sources.values()];
  }

  configured(): ListingSource[] {
    return this.list().filter((s) => s.isConfigured());
  }
}

/** App-wide singleton registry. */
export const sourceRegistry = new SourceRegistry();

sourceRegistry.register(new ManualIngestionSource());
