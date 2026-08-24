import { loadConfig } from "@/domain/config";
import { log } from "./logger";

export interface EmailDeliveryResult extends DeliveryResult {
  channel: "email";
}

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

/** Optional Resend-compatible delivery; credentials are never sent to the browser. */
export async function deliverEmailAlert(input: { to: string; subject: string; text: string }): Promise<EmailDeliveryResult> {
  const apiKey = process.env.EMAIL_API_KEY ?? process.env.RESEND_API_KEY;
  const endpoint = process.env.EMAIL_API_URL ?? "https://api.resend.com/emails";
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { channel: "email", status: "SKIPPED", attempts: 0 };
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text }) });
    if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`);
    return { channel: "email", status: "DELIVERED", attempts: 1 };
  } catch (error) {
    return { channel: "email", status: "FAILED", attempts: 1, error: error instanceof Error ? error.message : String(error) };
  }
}
