/**
 * Heuristic extraction of structured fields from pasted marketplace text.
 * Powers user-assisted ingestion (screenshots → copied text → structured listing).
 * Conservative: only extracts what it can defend; everything else stays null.
 */
import { extractVin } from "@/domain/vin";

export interface ParsedListingFields {
  price: number | null;
  mileage: number | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  location: string | null;
  sellerName: string | null;
}

const KNOWN_MAKES = [
  "acura", "audi", "bmw", "buick", "cadillac", "chevrolet", "chevy", "chrysler", "dodge",
  "ford", "genesis", "gmc", "honda", "hyundai", "infiniti", "jaguar", "jeep", "kia",
  "land rover", "lexus", "lincoln", "mazda", "mercedes-benz", "mercedes", "mini",
  "mitsubishi", "nissan", "porsche", "ram", "subaru", "tesla", "toyota", "volkswagen",
  "volvo", "volkswagon",
];

const MODEL_ALIASES: Record<string, string> = {
  chevy: "chevrolet",
  mercedes: "mercedes-benz",
  vw: "volkswagen",
  volkswagon: "volkswagen",
  "landrover": "land rover",
};

export function parseListingText(text: string): ParsedListingFields {
  const t = text.replace(/\u00a0/g, " ");
  const price = parsePrice(t);
  const mileage = parseMileage(t);
  const vin = extractVin(t);
  const { year, make, model, trim } = parseVehicle(t);
  const location = parseLocation(t);
  const sellerName = parseSeller(t);
  return { price, mileage, year, make, model, trim, vin, location, sellerName };
}

function parsePrice(text: string): number | null {
  // $12,500 / $12500 / 12,500 obo / asking 9500
  const patterns = [
    /\$\s?([\d,]{3,9})(?:\.\d{2})?\b/,
    /\b(?:asking|price|firm(?:\s+at)?)\s*:?\s*\$?\s?([\d,]{3,9})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n >= 100 && n <= 500_000) return n;
    }
  }
  return null;
}

function parseMileage(text: string): number | null {
  // 123k miles / 123,456 miles / 123456 mi / 123K
  const m =
    text.match(/\b([\d,]{2,3}(?:\.\d)?)\s?k\b/i) ??
    text.match(/\b([\d,]{4,7})\s?(?:miles?|mi\.?|k\s?miles?)\b/i) ??
    text.match(/\bodometer\s*:?\s*([\d,]{4,7})\b/i);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (/k\b/i.test(m[0]) && n < 1000) n *= 1000;
  if (n >= 1_000 && n <= 600_000) return n;
  return null;
}

const TRIM_RE =
  /\b(lx|ex|ex-?l|dx|si|gt|se|sel|le|xle|xlt|limited|touring|sport|base|premium|platinum|denali|trd\s+\w+|s\s?line|amg\s?\d*|m\d|type\s?r|sti|wrx|z71|fx4|titanium|sv|sl|srt)\b/i;

function parseVehicle(text: string): Pick<ParsedListingFields, "year" | "make" | "model" | "trim"> {
  const lower = text.toLowerCase();

  // Year: 1990–2030 not part of a larger number
  let year: number | null = null;
  const ym = lower.match(/\b(19[9]\d|20[0-3]\d)\b/);
  if (ym) year = Number(ym[1]);

  // Make
  let make: string | null = null;
  for (const m of KNOWN_MAKES) {
    if (new RegExp(`\\b${m.replace(/[-\s]/g, "[-\\s]?")}\\b`).test(lower)) {
      make = MODEL_ALIASES[m] ?? m;
      break;
    }
  }

  // Model: word(s) following the make, skipping trim badges and filler
  let model: string | null = null;
  let trim: string | null = null;
  if (make) {
    const makeIdx = lower.indexOf(make.split(" ")[0]);
    if (makeIdx !== -1) {
      const after = text.slice(makeIdx + make.length).trim();
      const words = after
        .replace(/[^a-zA-Z0-9\s'-]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
      const filler = new Set([
        "for", "sale", "by", "owner", "clean", "title", "miles", "mile", "needs", "runs",
        "great", "good", "condition", "new", "used", "the", "this", "with", "and", "in",
        "on", "at", "low", "high", "only", "just", "under", "obo", "firm", "price",
      ]);
      const trimMatch = lower.match(TRIM_RE);
      if (trimMatch) trim = trimMatch[1].toUpperCase();
      const modelWords: string[] = [];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const lw = w.toLowerCase();
        if (filler.has(lw)) break;
        if (/^\d{4}$/.test(lw) && modelWords.length === 0) continue; // stray year
        if (trim && lw === trim.toLowerCase()) break; // trim badge ends model capture
        if (TRIM_RE.test(w)) break;
        modelWords.push(w);
        // Named models carry a series number: "Silverado 1500".
        const next = words[i + 1];
        if (next && /^\d{2,4}$/.test(next)) modelWords.push(next);
        break;
      }
      if (modelWords.length > 0) model = modelWords.join(" ");
    }
  }

  return { year, make, model, trim };
}

function parseLocation(text: string): string | null {
  // "in Portland, OR" / "location: San Jose CA" / trailing "City, ST"
  const m =
    text.match(/\b(?:in|located\s+in|location\s*:?)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?,\s?[A-Z]{2})\b/) ??
    text.match(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?,\s?[A-Z]{2})\b/);
  return m ? m[1] : null;
}

function parseSeller(text: string): string | null {
  const m = text.match(/\b(?:seller|contact|posted\s+by)\s*:?\s*([A-Z][\w.\- ]{2,30})/);
  return m ? m[1].trim() : null;
}
