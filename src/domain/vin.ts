/**
 * VIN validation (ISO 3779 check digit), NHTSA vPIC decoding, and
 * listing-vs-decode mismatch detection. VIN is the canonical vehicle identifier.
 */
import type { VinConfidence, VinDecodeResult, VehicleAttributes } from "./types";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/; // excludes I, O, Q

const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Extract the first VIN-looking token from free text. */
export function extractVin(text: string): string | null {
  const m = text.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  return m ? m[0] : null;
}

export function validateVin(vin: string): { valid: boolean; reason?: string } {
  const v = vin.trim().toUpperCase();
  if (v.length !== 17) return { valid: false, reason: "VIN must be 17 characters" };
  if (!VIN_RE.test(v)) return { valid: false, reason: "VIN contains invalid characters (I, O, Q not allowed)" };
  // North American check digit (position 9). Some import VNs use it too; treat mismatch as invalid for our market.
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = v[i];
    const value = TRANSLITERATION[ch] ?? (ch >= "0" && ch <= "9" ? Number(ch) : NaN);
    if (Number.isNaN(value)) return { valid: false, reason: `Invalid character at position ${i + 1}` };
    sum += value * WEIGHTS[i];
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  if (v[8] !== expected) return { valid: false, reason: `Check digit mismatch (expected ${expected})` };
  return { valid: true };
}

export function vinConfidenceFor(
  vin: string | null,
  decode: VinDecodeResult | null,
): VinConfidence {
  if (!vin) return "NONE";
  if (!decode) return "PROVIDED_UNVERIFIED";
  if (!decode.valid) return "PROVIDED_UNVERIFIED";
  return decode.mismatches.length === 0 ? "DECODED_MATCH" : "DECODED_MISMATCH";
}

interface VpicResponse {
  Results: Array<{ Variable: string; Value: string | null }>;
}

function attrFrom(results: VpicResponse["Results"], variable: string): string | null {
  const row = results.find((r) => r.Variable === variable);
  const v = row?.Value;
  return v && v !== "" && v !== "Not Applicable" && v !== "0" ? v : null;
}

export function emptyAttributes(): VehicleAttributes {
  return { year: null, make: null, model: null, trim: null, bodyClass: null, fuelType: null, engineCylinders: null };
}

export interface DecodeDeps {
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  /** Injected cache lookup — returns cached decode if fresh enough. */
  cacheGet?: (vin: string) => VinDecodeResult | null | undefined;
  cacheSet?: (vin: string, result: VinDecodeResult) => void;
  now?: () => Date;
}

/** Compare decoded attributes against listing-stated attributes; list conflicts. */
export function detectMismatches(decoded: VehicleAttributes, stated: Partial<VehicleAttributes>): string[] {
  const mismatches: string[] = [];
  if (stated.year && decoded.year && stated.year !== decoded.year)
    mismatches.push(`Year: listing says ${stated.year}, VIN decodes to ${decoded.year}`);
  if (stated.make && decoded.make && stated.make.toLowerCase() !== decoded.make.toLowerCase())
    mismatches.push(`Make: listing says ${stated.make}, VIN decodes to ${decoded.make}`);
  if (stated.model && decoded.model && !decoded.model.toLowerCase().includes(stated.model.toLowerCase()))
    mismatches.push(`Model: listing says ${stated.model}, VIN decodes to ${decoded.model}`);
  return mismatches;
}

/** Decode a VIN via NHTSA vPIC. Falls back to format-only result on network failure. */
export async function decodeVin(vin: string, deps: DecodeDeps): Promise<VinDecodeResult> {
  const now = (deps.now ?? (() => new Date()))();
  const v = vin.trim().toUpperCase();

  const cached = deps.cacheGet?.(v);
  if (cached) return { ...cached, source: "cache", decodedAt: now.toISOString() };

  const valid = validateVin(v);
  if (!valid.valid) {
    return {
      vin: v, valid: false, attributes: emptyAttributes(), matchConfidence: 0,
      mismatches: [valid.reason ?? "invalid VIN"], decodedAt: now.toISOString(), source: "manual",
    };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs);
    const fetchImpl = deps.fetchImpl ?? fetch;
    const url = `${deps.baseUrl}/DecodeVinValues/${encodeURIComponent(v)}?format=json`;
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`vPIC HTTP ${res.status}`);
    const body = (await res.json()) as { Results: VpicResponse["Results"] };
    const rows = body.Results ?? [];
    const cylRaw = attrFrom(rows, "Engine Number of Cylinders");
    const attributes: VehicleAttributes = {
      year: attrFrom(rows, "Model Year") ? Number(attrFrom(rows, "Model Year")) : null,
      make: attrFrom(rows, "Make"),
      model: attrFrom(rows, "Model"),
      trim: attrFrom(rows, "Trim"),
      bodyClass: attrFrom(rows, "Body Class"),
      fuelType: attrFrom(rows, "Fuel Type - Primary"),
      engineCylinders: cylRaw ? Number(cylRaw) : null,
    };
    const gotSomething = Boolean(attributes.make || attributes.model || attributes.year);
    const result: VinDecodeResult = {
      vin: v,
      valid: gotSomething,
      attributes,
      matchConfidence: gotSomething ? 0.95 : 0.3,
      mismatches: [],
      decodedAt: now.toISOString(),
      source: "nhtsa-vpic",
    };
    deps.cacheSet?.(v, result);
    return result;
  } catch {
    // Network failure: keep format-valid status; do NOT fabricate attributes.
    return {
      vin: v, valid: true, attributes: emptyAttributes(), matchConfidence: 0.4,
      mismatches: [], decodedAt: now.toISOString(), source: "manual",
    };
  }
}
