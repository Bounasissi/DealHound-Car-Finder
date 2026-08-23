/** Approved vehicle-history provider boundary. Production never fabricates title evidence. */
import { loadConfig } from "@/domain/config";
import type { HistoryCheck, TitleState } from "@/domain/types";
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`History provider timed out after ${ms}ms`)), ms)),
  ]);
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
        const response = await withTimeout(
          fetch(`${this.url.replace(/\/$/, "")}/vins/${encodeURIComponent(vin)}`, {
            headers: { accept: "application/json", authorization: `Bearer ${this.apiKey}` },
            cache: "no-store",
          }),
          this.timeoutMs,
        );
        if (!response.ok) throw new Error(`History provider returned HTTP ${response.status}`);
        const body = (await response.json()) as ProviderResponse;
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
