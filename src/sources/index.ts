/**
 * Provider-neutral listing source abstraction.
 *
 * Implementations:
 *  - ManualIngestionSource: Facebook Marketplace user-assisted ingestion
 *    (screenshots/copied text/URLs). No scraping — the user supplies content.
 *  - CsvListingSource: user-provided CSV import. No remote access is implied.
 *  - MarketCheckFsboSource: optional licensed private-party feed. It can be
 *    narrowed to a source domain such as facebook.com through configuration;
 *    it never logs into Facebook or crawls Marketplace directly.
 *
 * Extensibility: other authorized listing adapters implement the same interface
 * and register themselves — no scoring or persistence changes required.
 */
import { parseListingText } from "@/lib/parser";
import type { ListingSourceKind, RawListing, SearchProfile } from "@/domain/types";
import { MarketCheckFsboSource } from "./marketcheck";

export { MarketCheckFsboSource, buildMarketCheckSearchParams, marketCheckListingToRaw } from "./marketcheck";

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
  sourceId?: string;
  sourceKind?: RawListing["sourceKind"];
  pastedText?: string;
  url?: string;
  /** Optional user-entered KBB Good-condition reference for immediate evaluation. */
  kbbGoodValue?: number;
  screenshotNotes?: string[];
  photoNotes?: string[];
  overrides?: Partial<RawListing>;
}

/** Parse a small, user-provided CSV export without making network requests. */
export function parseCsvListings(csv: string): ManualIngestInput[] {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) throw new Error("CSV import requires a header row and at least one listing row");
  const headers = rows[0].map((header) => normalizeHeader(header));
  const index = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const at = (row: string[], names: string[]) => {
    const i = index(names);
    return i >= 0 ? row[i]?.trim() || undefined : undefined;
  };
  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row) => {
    const price = numberCell(at(row, ["price", "askingprice", "asking"]));
    const mileage = integerCell(at(row, ["mileage", "miles", "odometer"]));
    const kbbGoodValueRaw = numberCell(at(row, ["kbbgoodvalue", "kbbgood", "goodvalue", "referencegoodvalue"]));
    const kbbGoodValue = kbbGoodValueRaw !== undefined && kbbGoodValueRaw >= 100 && kbbGoodValueRaw <= 1_000_000 ? kbbGoodValueRaw : undefined;
    const year = integerCell(at(row, ["year"]));
    const vin = at(row, ["vin"]);
    return {
      pastedText: [at(row, ["title", "name"]), at(row, ["description", "details"]), at(row, ["titleclaim", "title"])].filter(Boolean).join("\n") || undefined,
      url: at(row, ["url", "listingurl", "link"]),
      kbbGoodValue,
      overrides: {
        title: at(row, ["title", "name"]),
        price,
        mileage,
        vin: vin && vin.length === 17 ? vin.toUpperCase() : undefined,
        year,
        make: at(row, ["make", "brand"]),
        model: at(row, ["model"]),
        trim: at(row, ["trim"]),
        location: at(row, ["location", "city"]),
        sellerName: at(row, ["seller", "sellername"]),
        sellerContact: at(row, ["contact", "sellercontact"]),
      },
    } satisfies ManualIngestInput;
  });
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numberCell(value?: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function integerCell(value?: string): number | undefined {
  const n = numberCell(value);
  return n === undefined ? undefined : Math.round(n);
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && csv[i + 1] === "\n") i += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
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
    sourceId: input.sourceId ?? "facebook-marketplace-manual",
    sourceKind: input.sourceKind ?? "marketplace-screenshot",
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

/**
 * Import a user-provided listing URL only when its host is explicitly
 * allowlisted by the operator. This deliberately accepts JSON or plain text
 * feeds, never scrapes arbitrary HTML, and never follows redirects to a new
 * host.
 */
export async function fetchAllowlistedListingUrl(url: string): Promise<ManualIngestInput> {
  const parsed = new URL(url);
  const allowedHosts = (process.env.ALLOWED_LISTING_URL_HOSTS ?? "")
    .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw new Error("URL import is disabled for this host; paste the listing or configure an explicit allowlist");
  }
  const response = await fetch(parsed.toString(), {
    headers: { accept: "application/json, text/plain" },
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Allowlisted listing URL returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json") && !contentType.includes("text/plain")) {
    throw new Error("URL import accepts only an allowlisted JSON or plain-text feed; HTML pages must be pasted manually");
  }
  const rawText = await response.text();
  if (rawText.length > 100_000) throw new Error("Allowlisted listing response is too large");
  if (contentType.includes("json")) {
    const value = JSON.parse(rawText) as Record<string, unknown>;
    const text = typeof value.description === "string" ? value.description : rawText;
    return {
      sourceId: "allowlisted-url-import",
      sourceKind: "manual-ingestion",
      pastedText: text,
      url: parsed.toString(),
      overrides: {
        title: stringValue(value.title),
        price: numberValue(value.price),
        mileage: numberValue(value.mileage),
        vin: typeof value.vin === "string" && value.vin.length === 17 ? value.vin.toUpperCase() : undefined,
        year: numberValue(value.year),
        make: stringValue(value.make),
        model: stringValue(value.model),
        trim: stringValue(value.trim),
        location: stringValue(value.location),
      },
    };
  }
  return { sourceId: "allowlisted-url-import", sourceKind: "manual-ingestion", pastedText: rawText, url: parsed.toString() };
}

function stringValue(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function numberValue(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[$,\s]/g, "")) : NaN;
  return Number.isFinite(n) ? n : undefined;
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

export class CsvListingSource implements ListingSource {
  readonly id = "csv-manual-import";
  readonly label = "CSV (user-provided import)";
  readonly kind = "manual-ingestion" as const;
  isConfigured() { return true; }
  async fetchListings(_profile: SearchProfile): Promise<RawListing[]> { void _profile; return []; }
}

// ---------------------------------------------------------------------------
// Production-shaped mock inventory adapter
// ---------------------------------------------------------------------------

export interface InventoryApiConfig {
  baseUrl: string;
  apiKey: string;
}

export class HttpInventoryAdapter implements ListingSource {
  readonly id = "licensed-inventory-api";
  readonly label = "Licensed inventory feed";
  readonly kind = "inventory-api" as const;

  constructor(private config: InventoryApiConfig, private timeoutMs = 8000) {}

  isConfigured(): boolean { return Boolean(this.config.baseUrl && this.config.apiKey); }

  async fetchListings(profile: SearchProfile): Promise<RawListing[]> {
    const params = new URLSearchParams({ zip: profile.zip, radiusMiles: String(profile.radiusMiles) });
    const response = await Promise.race([
      fetch(`${this.config.baseUrl.replace(/\/$/, "")}/listings?${params}`, { headers: { accept: "application/json", authorization: `Bearer ${this.config.apiKey}` }, cache: "no-store" }),
      new Promise<Response>((_, reject) => setTimeout(() => reject(new Error(`Inventory provider timed out after ${this.timeoutMs}ms`)), this.timeoutMs)),
    ]);
    if (!response.ok) throw new Error(`Inventory provider returned HTTP ${response.status}`);
    const body = (await response.json()) as { listings?: RawListing[] };
    return (body.listings ?? []).filter((listing) => matchesProfile(listing, profile));
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
  if (p.trim && !(listing.trim ?? "").toLowerCase().includes(p.trim.toLowerCase())) return false;
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
sourceRegistry.register(new CsvListingSource());
if (process.env.INVENTORY_API_URL && process.env.INVENTORY_API_KEY) {
  sourceRegistry.register(new HttpInventoryAdapter({ baseUrl: process.env.INVENTORY_API_URL, apiKey: process.env.INVENTORY_API_KEY }));
}
if (process.env.MARKETCHECK_API_KEY) {
  sourceRegistry.register(new MarketCheckFsboSource({
    apiKey: process.env.MARKETCHECK_API_KEY,
    baseUrl: process.env.MARKETCHECK_API_BASE_URL,
    source: process.env.MARKETCHECK_SOURCE ?? "facebook.com",
    timeoutMs: Number(process.env.MARKETCHECK_TIMEOUT_MS ?? 8000),
  }));
}
