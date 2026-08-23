import { loadConfig } from "@/domain/config";
import { log } from "./logger";

export interface DeliveryResult {
  status: "DELIVERED" | "SKIPPED" | "FAILED";
  attempts: number;
  error?: string;
}

export async function deliverAlert(payload: unknown): Promise<DeliveryResult> {
  const config = loadConfig();
  if (!config.alertWebhookUrl) return { status: "SKIPPED", attempts: 0 };
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await Promise.race([
        fetch(config.alertWebhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }),
        new Promise<Response>((_, reject) => setTimeout(() => reject(new Error("Alert webhook timeout")), config.alertWebhookTimeoutMs)),
      ]);
      if (!response.ok) throw new Error(`Alert webhook returned HTTP ${response.status}`);
      log.info("alert.delivered", { attempt });
      return { status: "DELIVERED", attempts: attempt };
    } catch (error) {
      lastError = error;
    }
  }
  log.error("alert.delivery_failed", { error: lastError instanceof Error ? lastError.message : String(lastError), attempts: 3 });
  return { status: "FAILED", attempts: 3, error: lastError instanceof Error ? lastError.message : String(lastError) };
}
