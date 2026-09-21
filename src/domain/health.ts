export type ProviderHealth = {
  valuation: string;
  history: string;
  inventory: string;
  jobs: string;
  storage: string;
};

/**
 * Distinguishes the supported manual/user-assisted mode from a fully
 * provisioned production deployment. Manual mode remains usable, but must
 * never be mistaken for readiness to run unattended discovery and delivery.
 */
export function assessReleaseReadiness(providers: ProviderHealth) {
  const missing: string[] = [];
  if (providers.valuation !== "configured") missing.push("valuation-provider");
  if (providers.history !== "configured") missing.push("history-provider");
  if (providers.inventory !== "configured") missing.push("inventory-source");
  if (providers.jobs !== "configured") missing.push("scheduled-jobs");
  if (providers.storage !== "configured") missing.push("object-storage");

  return {
    mode: missing.length === 0 ? "automated" as const : "manual-user-assisted" as const,
    ready: missing.length === 0,
    missing,
  };
}
