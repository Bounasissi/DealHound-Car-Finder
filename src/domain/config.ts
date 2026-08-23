/**
 * Central configuration with safe defaults, overridable via environment.
 * No hardcoded secrets — everything here is non-sensitive tuning.
 */

function num(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function bool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  return v === "true" || v === "1";
}

export interface AppConfig {
  /** Gate A: asking / reference-good-value must be <= this. */
  gateARatio: number;
  /** Gate B: expected all-in basis / conservative finished value must be <= this. */
  gateBRatio: number;
  /** Finished-value conservatism: post-repair private-party value factor vs KBB Good. */
  finishedValueFactor: number;
  /** Sales tax + title/registration default rate (state-configurable). */
  taxTitleFeeRate: number;
  /** Default pre-purchase inspection cost. */
  inspectionFee: number;
  /** Default transportation/towing cost assumption. */
  transportationCost: number;
  /** Immediate maintenance reserve added to every deal (fluids, filters, battery triage). */
  immediateMaintenanceBase: number;
  /** Risk reserve = riskReservePct * expectedRepairs + riskReserveBase. */
  riskReservePct: number;
  riskReserveBase: number;
  /** Ratio below which a deal is an "extreme bargain" requiring enhanced scrutiny. */
  extremeBargainRatio: number;
  /** Alert rule defaults. */
  alertMinScore: number;
  alertMaxAskingRatio: number;
  alertMinTitleRank: number;
  alertRequireNoMajorMechanicalRisk: boolean;
  /** NHTSA vPIC base URL (public, keyless). */
  vpicBaseUrl: string;
  vpicTimeoutMs: number;
  /** Bearer token used by the local single-user deployment. */
  appAccessToken: string;
  /** Stable owner id for the single-token deployment. */
  appUserId: string;
  /** Explicitly allow unauthenticated local development only. */
  allowUnauthenticatedLocal: boolean;
  /** Reserve applied when no repair evidence is present. */
  unknownRepairReserve: number;
  /** Remote approved history-provider endpoint. */
  historyProviderUrl: string;
  historyProviderApiKey: string;
  historyTimeoutMs: number;
  valuationProviderUrl: string;
  valuationProviderApiKey: string;
  valuationTimeoutMs: number;
  alertWebhookUrl: string;
  alertWebhookTimeoutMs: number;
  apiRateLimitPerMinute: number;
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    gateARatio: num("GATE_A_RATIO", 0.7),
    gateBRatio: num("GATE_B_RATIO", 0.8),
    finishedValueFactor: num("FINISHED_VALUE_FACTOR", 0.9),
    taxTitleFeeRate: num("TAX_TITLE_FEE_RATE", 0.08),
    inspectionFee: num("INSPECTION_FEE", 200),
    transportationCost: num("TRANSPORTATION_COST", 150),
    immediateMaintenanceBase: num("IMMEDIATE_MAINTENANCE_BASE", 150),
    riskReservePct: num("RISK_RESERVE_PCT", 0.15),
    riskReserveBase: num("RISK_RESERVE_BASE", 200),
    extremeBargainRatio: num("EXTREME_BARGAIN_RATIO", 0.45),
    alertMinScore: num("ALERT_MIN_SCORE", 85),
    alertMaxAskingRatio: num("ALERT_MAX_ASKING_RATIO", 0.7),
    alertMinTitleRank: num("ALERT_MIN_TITLE_RANK", 2),
    alertRequireNoMajorMechanicalRisk: bool("ALERT_REQUIRE_NO_MAJOR_RISK", true),
    vpicBaseUrl: process.env.VPIC_BASE_URL ?? "https://vpic.nhtsa.dot.gov/api/vehicles",
    vpicTimeoutMs: num("VPIC_TIMEOUT_MS", 8000),
    appAccessToken: process.env.APP_ACCESS_TOKEN ?? "",
    appUserId: process.env.APP_USER_ID ?? "primary",
    allowUnauthenticatedLocal: bool("ALLOW_UNAUTHENTICATED_LOCAL", process.env.NODE_ENV !== "production"),
    unknownRepairReserve: num("UNKNOWN_REPAIR_RESERVE", 1500),
    historyProviderUrl: process.env.HISTORY_PROVIDER_URL ?? "",
    historyProviderApiKey: process.env.HISTORY_PROVIDER_API_KEY ?? "",
    historyTimeoutMs: num("HISTORY_TIMEOUT_MS", 8000),
    valuationProviderUrl: process.env.VALUATION_PROVIDER_URL ?? "",
    valuationProviderApiKey: process.env.VALUATION_PROVIDER_API_KEY ?? "",
    valuationTimeoutMs: num("VALUATION_TIMEOUT_MS", 8000),
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ?? "",
    alertWebhookTimeoutMs: num("ALERT_WEBHOOK_TIMEOUT_MS", 5000),
    apiRateLimitPerMinute: num("API_RATE_LIMIT_PER_MINUTE", 120),
    ...overrides,
  };
}
