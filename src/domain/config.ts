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
  /** Optional bearer token gate for the API. Empty = auth disabled (local single-user). */
  appAccessToken: string;
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
    ...overrides,
  };
}
