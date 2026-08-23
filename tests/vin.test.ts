import { describe, expect, it } from "vitest";
import {
  decodeVin,
  detectMismatches,
  emptyAttributes,
  extractVin,
  validateVin,
  vinConfidenceFor,
} from "@/domain/vin";
import { VIN_ACCORD, VIN_CAMRY } from "./fixtures";

describe("validateVin", () => {
  it("accepts known-valid VINs", () => {
    expect(validateVin(VIN_ACCORD)).toEqual({ valid: true });
    expect(validateVin(VIN_CAMRY)).toEqual({ valid: true });
  });

  it("rejects wrong length", () => {
    const r = validateVin("1HGCM82633A00435");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("17 characters");
  });

  it("rejects I/O/Q characters", () => {
    expect(validateVin("1HGCM82633A00435I").valid).toBe(false);
  });

  it("rejects bad check digit", () => {
    // Flip position 9 of a valid VIN
    const tampered = VIN_ACCORD.slice(0, 8) + "4" + VIN_ACCORD.slice(9);
    expect(validateVin(tampered).valid).toBe(false);
  });

  it("is case-insensitive on input", () => {
    expect(validateVin(VIN_ACCORD.toLowerCase()).valid).toBe(true);
  });
});

describe("extractVin", () => {
  it("finds VIN in free text", () => {
    expect(extractVin(`Call me about it. VIN: ${VIN_CAMRY.toLowerCase()} thanks`)).toBe(VIN_CAMRY);
  });
  it("returns null when absent", () => {
    expect(extractVin("no vin here, sorry")).toBeNull();
  });
});

describe("detectMismatches", () => {
  it("flags year/make/model conflicts", () => {
    const decoded = { ...emptyAttributes(), year: 2015, make: "Toyota", model: "Camry" };
    const mismatches = detectMismatches(decoded, { year: 2016, make: "Honda", model: "Accord" });
    expect(mismatches).toHaveLength(3);
  });
  it("passes when consistent", () => {
    const decoded = { ...emptyAttributes(), year: 2016, make: "Toyota", model: "Camry LE" };
    expect(detectMismatches(decoded, { year: 2016, make: "toyota", model: "Camry" })).toHaveLength(0);
  });
  it("ignores null stated fields", () => {
    expect(detectMismatches(emptyAttributes(), {})).toHaveLength(0);
  });
});

describe("vinConfidenceFor", () => {
  it("NONE without vin", () => {
    expect(vinConfidenceFor(null, null)).toBe("NONE");
  });
  it("PROVIDED_UNVERIFIED without decode", () => {
    expect(vinConfidenceFor(VIN_CAMRY, null)).toBe("PROVIDED_UNVERIFIED");
  });
  it("DECODED_MATCH / DECODED_MISMATCH via decode result", () => {
    const base = {
      vin: VIN_CAMRY, valid: true, attributes: emptyAttributes(),
      matchConfidence: 0.95, mismatches: [], decodedAt: "now", source: "nhtsa-vpic" as const,
    };
    expect(vinConfidenceFor(VIN_CAMRY, base)).toBe("DECODED_MATCH");
    expect(vinConfidenceFor(VIN_CAMRY, { ...base, mismatches: ["Year conflict"] })).toBe("DECODED_MISMATCH");
  });
});

describe("decodeVin", () => {
  const deps = (results: Array<{ Variable: string; Value: string | null }>) => ({
    baseUrl: "https://vpic.example/api",
    timeoutMs: 1000,
    fetchImpl: (async () =>
      new Response(JSON.stringify({ Results: results }), { status: 200 })) as unknown as typeof fetch,
  });

  it("maps vPIC fields into normalized attributes and caches", async () => {
    const cache = new Map<string, unknown>();
    const d = deps([
      { Variable: "Model Year", Value: "2016" },
      { Variable: "Make", Value: "TOYOTA" },
      { Variable: "Model", Value: "Camry" },
      { Variable: "Trim", Value: "LE" },
      { Variable: "Body Class", Value: "Sedan" },
      { Variable: "Fuel Type - Primary", Value: "Gasoline" },
      { Variable: "Engine Number of Cylinders", Value: "4" },
    ]);
    const result = await decodeVin(VIN_CAMRY, {
      ...d,
      cacheGet: (v) => cache.get(v) as never,
      cacheSet: (v, r) => void cache.set(v, r),
    });
    expect(result.attributes.year).toBe(2016);
    expect(result.attributes.make).toBe("TOYOTA");
    expect(result.attributes.engineCylinders).toBe(4);
    expect(cache.has(VIN_CAMRY)).toBe(true);

    const second = await decodeVin(VIN_CAMRY, {
      ...d,
      cacheGet: (v) => cache.get(v) as never,
      cacheSet: (v, r) => void cache.set(v, r),
    });
    expect(second.source).toBe("cache");
  });

  it("falls back to format-valid result on network failure without fabricating attributes", async () => {
    const fetchFail = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const result = await decodeVin(VIN_CAMRY, {
      baseUrl: "https://vpic.example/api",
      timeoutMs: 50,
      fetchImpl: fetchFail,
    });
    expect(result.valid).toBe(true); // format was validated
    expect(result.attributes.make).toBeNull();
    expect(result.matchConfidence).toBeLessThan(0.5);
  });

  it("returns invalid for malformed VIN without network call", async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      throw new Error("should not be called");
    }) as unknown as typeof fetch;
    const result = await decodeVin("NOT_A_VIN", {
      baseUrl: "x", timeoutMs: 10, fetchImpl: spy,
    });
    expect(called).toBe(false);
    expect(result.valid).toBe(false);
  });
});
