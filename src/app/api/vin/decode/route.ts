import { jsonOk, withApi } from "@/lib/api";
import { loadConfig } from "@/domain/config";
import { decodeVin, validateVin } from "@/domain/vin";
import { getCachedVin, setCachedVin } from "@/lib/repo";

/** Decode + validate a VIN via NHTSA vPIC (cached). */
export const GET = withApi("vin.decode", async (req) => {
  const url = new URL(req.url);
  const vin = (url.searchParams.get("vin") ?? "").trim().toUpperCase();
  if (!vin) throw new Error("vin query parameter required");
  const format = validateVin(vin);
  const config = loadConfig();
  const decoded = await decodeVin(vin, {
    baseUrl: config.vpicBaseUrl,
    timeoutMs: config.vpicTimeoutMs,
    cacheGet: (v) => getCachedVin(v),
    cacheSet: setCachedVin,
  });
  return jsonOk({ format, decoded });
});
