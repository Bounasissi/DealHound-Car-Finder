export interface UsageLimits {
  listingImports: number;
  evaluations: number;
  aiAnalyses: number;
  titleChecks: number;
  valuationCalls: number;
  providerCalls: number;
}

export function defaultUsageLimits(): UsageLimits {
  return {
    listingImports: Number(process.env.USAGE_LISTING_IMPORTS_PER_DAY ?? 100),
    evaluations: Number(process.env.USAGE_EVALUATIONS_PER_DAY ?? 200),
    aiAnalyses: Number(process.env.USAGE_AI_ANALYSES_PER_DAY ?? 30),
    titleChecks: Number(process.env.USAGE_TITLE_CHECKS_PER_DAY ?? 20),
    valuationCalls: Number(process.env.USAGE_VALUATION_CALLS_PER_DAY ?? 100),
    providerCalls: Number(process.env.USAGE_PROVIDER_CALLS_PER_DAY ?? 500),
  };
}

export function consumeUsage(current: number, limit: number, amount = 1): { allowed: boolean; next: number } {
  const next = current + amount;
  const allowed = amount >= 0 && next <= limit;
  return { allowed, next: allowed ? next : current };
}
