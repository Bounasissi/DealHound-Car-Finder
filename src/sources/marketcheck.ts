import type { ListingSource } from "./index";
import type { RawListing, SearchProfile } from "@/domain/types";
import { matchesProfile } from "./index";

const DEFAULT_BASE_URL = "https://api.marketcheck.com";

export interface MarketCheckFsboConfig {
  apiKey: string;
  baseUrl?: string;
  /** Optional source domain, e.g. facebook.com. Empty searches all FSBO sources. */
  source?: string;
  timeoutMs?: number;
}

interface MarketCheckListing {
  id: string;
  vin?: string;
  heading?: string;
  description?: string;
  price?: number;
  miles?: number;
  vdp_url?: string;
  source?: string;
  seller_type?: string;
  first_seen_at_source_date?: string;
  first_seen_at_date?: string;
  last_seen_at_date?: string;
  dist?: number;
  city?: string;
  state?: string;
  zip?: string;
  carfax_clean_title?: boolean;
  media?: { photo_links?: string[]; photo_links_cached?: string[] };
  build?: { year?: number; make?: string; model?: string; trim?: string; body_type?: string; fuel_type?: string; cylinders?: number };
}

interface MarketCheckSearchResponse {
  listings?: MarketCheckListing[];
}

export type MarketCheckFetch = (input: string, init?: RequestInit) => Promise<Response>;

export class MarketCheckFsboSource implements ListingSource {
  readonly id = "marketcheck-fsbo";
  readonly label = "MarketCheck private-party feed";
  readonly kind = "inventory-api" as const;

  constructor(
    private readonly config: MarketCheckFsboConfig,
    private readonly fetchImpl: MarketCheckFetch = (input, init) => fetch(input, init),
  ) {}

  isConfigured(): boolean {
    return this.config.apiKey.trim().length > 0;
  }

  async fetchListings(profile: SearchProfile): Promise<RawListing[]> {
    if (!this.isConfigured()) throw new Error("MarketCheck source is not configured");

    const url = new URL("/v2/search/car/fsbo/active", this.config.baseUrl || DEFAULT_BASE_URL);
    const params = buildMarketCheckSearchParams(profile, this.config);
    url.search = params.toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 8000);
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`MarketCheck request timed out after ${this.config.timeoutMs ?? 8000}ms`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) throw new Error(`MarketCheck returned HTTP ${response.status}`);
    const body = (await response.json()) as MarketCheckSearchResponse;
    return (body.listings ?? [])
      .map(marketCheckListingToRaw)
      .filter((listing) => matchesProfile(listing, profile));
  }
}

export function buildMarketCheckSearchParams(profile: SearchProfile, config: MarketCheckFsboConfig): URLSearchParams {
  const params = new URLSearchParams({
    api_key: config.apiKey,
    country: "us",
    zip: profile.zip,
    radius: String(Math.min(profile.radiusMiles, 100)),
    rows: "50",
    dedup: "true",
    sort_by: "last_seen_at",
    sort_order: "desc",
  });

  if (profile.make) params.set("make", profile.make);
  if (profile.model) params.set("model", profile.model);
  if (profile.trim) params.set("trim", profile.trim);
  if (profile.yearMin !== null || profile.yearMax !== null) {
    params.set("year_range", `${profile.yearMin ?? "*"}-${profile.yearMax ?? "*"}`);
  }
  if (profile.mileageMax !== null) params.set("miles_range", `0-${profile.mileageMax}`);
  if (profile.priceMin !== null || profile.priceMax !== null) {
    params.set("price_range", `${profile.priceMin ?? "*"}-${profile.priceMax ?? "*"}`);
  }
  if (profile.requireCleanTitle) params.set("carfax_clean_title", "true");
  if (config.source?.trim()) params.set("source", config.source.trim());
  return params;
}

export function marketCheckListingToRaw(listing: MarketCheckListing): RawListing {
  const build = listing.build ?? {};
  const heading = listing.heading ?? [build.year, build.make, build.model, build.trim].filter(Boolean).join(" ");
  const location = [listing.city, listing.state, listing.zip].filter(Boolean).join(", ") || undefined;
  const photoLinks = [...(listing.media?.photo_links_cached ?? []), ...(listing.media?.photo_links ?? [])];

  return {
    sourceId: "marketcheck-fsbo",
    sourceKind: "inventory-api",
    sourceListingId: listing.id,
    url: listing.vdp_url,
    rawText: heading || undefined,
    title: heading || undefined,
    description: listing.description,
    price: listing.price,
    mileage: listing.miles,
    location,
    vin: listing.vin,
    year: build.year,
    make: build.make,
    model: build.model,
    trim: build.trim,
    sellerType: "private",
    photos: photoLinks.map((url) => ({ url })),
    postedAt: listing.first_seen_at_source_date ?? listing.first_seen_at_date ?? listing.last_seen_at_date,
  };
}
