import { describe, expect, it } from "vitest";
import { isQuietHours, shouldDeliverNotification } from "@/domain/notifications";

describe("notification preferences", () => {
  it("recognizes quiet hours including an overnight window", () => {
    expect(isQuietHours(23, 22, 7)).toBe(true);
    expect(isQuietHours(6, 22, 7)).toBe(true);
    expect(isQuietHours(12, 22, 7)).toBe(false);
  });

  it("requires score and margin thresholds before outbound delivery", () => {
    const preference = { minimumScore: 80, minimumMargin: 2500, deliveryMode: "IMMEDIATE" as const, quietHoursStart: null, quietHoursEnd: null };
    expect(shouldDeliverNotification({ score: 85, margin: 3000, hour: 12 }, preference)).toBe(true);
    expect(shouldDeliverNotification({ score: 79, margin: 3000, hour: 12 }, preference)).toBe(false);
    expect(shouldDeliverNotification({ score: 85, margin: 2000, hour: 12 }, preference)).toBe(false);
  });
});
