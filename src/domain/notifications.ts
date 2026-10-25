export interface NotificationPreferenceInput {
  minimumScore: number;
  minimumMargin: number;
  deliveryMode: "IMMEDIATE" | "DIGEST" | "NONE";
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

export function isQuietHours(hour: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null || start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function shouldDeliverNotification(input: { score: number; margin: number; hour: number }, preference: NotificationPreferenceInput): boolean {
  if (preference.deliveryMode !== "IMMEDIATE") return false;
  if (input.score < preference.minimumScore || input.margin < preference.minimumMargin) return false;
  return !isQuietHours(input.hour, preference.quietHoursStart, preference.quietHoursEnd);
}
