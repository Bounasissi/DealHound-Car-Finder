/** Approved vehicle-history provider boundary. Production never fabricates title evidence. */
import { loadConfig } from "@/domain/config";
import { TITLE_STATES, type HistoryCheck, type TitleState } from "@/domain/types";
import { normalizeBrands } from "@/domain/title";

export interface HistoryProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  check(vin: string): Promise<HistoryCheck>;
}

export class HistoryProviderUnavailableError extends Error {
  readonly code = "HISTORY_PROVIDER_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "HistoryProviderUnavailableError";
  }
}

interface ProviderResponse {
  provider?: string;
  titleState?: TitleState;
  brands?: string[];
  accidentCount?: number | null;
  odometerReadings?: number[];
  raw?: unknown;
}

/** Generic adapter for an approved vendor endpoint using a stable JSON contract. */
export class HttpHistoryProvider implements HistoryProvider {
  readonly id: string;
  readonly label: string;

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    id = "approved-history-provider",
    label = "Approved vehicle-history provider",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.id = id;
    this.label = label;
  }

  isConfigured(): boolean {
    return Boolean(this.url && this.apiKey);
  }

  async check(vin: string): Promise<HistoryCheck> {
    if (!this.isConfigured()) {
      throw new HistoryProviderUnavailableError(
        "No external history provider is configured. Record a seller claim or manual document review in the title section, or configure an approved provider.",
      );
    }
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        let response: Response;
        try {
          response = await this.fetchImpl(`${this.url.replace(/\/$/, "")}/vins/${encodeURIComponent(vin)}`, {
            headers: { accept: "application/json", authorization: `Bearer ${this.apiKey}` },
            cache: "no-store",
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted) throw new Error(`History provider timed out after ${this.timeoutMs}ms`);
          throw error;
        } finally {
          clearTimeout(timeout);
        }
        if (!response.ok) throw new Error(`History provider returned HTTP ${response.status}`);
        let rawBody: unknown;
        try {
          rawBody = await response.json();
        } catch {
          throw new Error("History provider returned invalid JSON");
        }
        const body = parseProviderResponse(rawBody);
        return {
          provider: body.provider ?? this.id,
          vin,
          titleState: body.titleState ?? "UNKNOWN",
          brands: normalizeBrands(body.brands ?? []),
          accidentCount: body.accidentCount ?? null,
          odometerReadings: body.odometerReadings ?? [],
          raw: body.raw ?? body,
          checkedAt: new Date().toISOString(),
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw new HistoryProviderUnavailableError(
      `Approved history provider failed after retry: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }
}

function parseProviderResponse(value: unknown): ProviderResponse {
  if (!isRecord(value)) throw new Error("History provider returned an invalid payload");
  if (value.provider !== undefined && typeof value.provider !== "string") throw new Error("History provider returned an invalid provider");
  if (value.titleState !== undefined && (typeof value.titleState !== "string" || !TITLE_STATES.includes(value.titleState as TitleState))) {
    throw new Error("History provider returned an invalid titleState");
  }
  if (value.brands !== undefined && (!Array.isArray(value.brands) || value.brands.some((brand) => typeof brand !== "string"))) {
    throw new Error("History provider returned invalid brands");
  }
  if (value.accidentCount !== undefined && value.accidentCount !== null && (typeof value.accidentCount !== "number" || !Number.isFinite(value.accidentCount))) {
    throw new Error("History provider returned an invalid accidentCount");
  }
  if (value.odometerReadings !== undefined && (!Array.isArray(value.odometerReadings) || value.odometerReadings.some((reading) => typeof reading !== "number" || !Number.isFinite(reading)))) {
    throw new Error("History provider returned invalid odometerReadings");
  }
  return {
    provider: value.provider as string | undefined,
    titleState: value.titleState as TitleState | undefined,
    brands: value.brands as string[] | undefined,
    accidentCount: value.accidentCount as number | null | undefined,
    odometerReadings: value.odometerReadings as number[] | undefined,
    raw: value.raw,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const config = loadConfig();
export const historyProvider = new HttpHistoryProvider(
  config.historyProviderUrl,
  config.historyProviderApiKey,
  config.historyTimeoutMs,
);

/** Explicit seed fixture helper; never used by the runtime provider. */
export function seedHistoryCheck(vin: string, brands: string[] = []): HistoryCheck {
  return {
    provider: "seed-fixture",
    vin,
    titleState: "HISTORY_CLEAN",
    brands: normalizeBrands(brands),
    accidentCount: null,
    odometerReadings: [],
    raw: { fixture: true },
    checkedAt: new Date().toISOString(),
  };
}
