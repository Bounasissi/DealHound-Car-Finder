import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { currentUserId } from "./auth";

export interface NotificationPreferences {
  minimumScore: number;
  minimumMargin: number;
  deliveryMode: "IMMEDIATE" | "DIGEST" | "NONE";
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  email: string | null;
}

function toPreferences(row: typeof userPreferences.$inferSelect): NotificationPreferences {
  return { minimumScore: row.minimumScore, minimumMargin: Number(row.minimumMargin), deliveryMode: row.deliveryMode === "NONE" ? "NONE" : row.deliveryMode === "DIGEST" ? "DIGEST" : "IMMEDIATE", quietHoursStart: row.quietHoursStart, quietHoursEnd: row.quietHoursEnd, email: row.email };
}

export async function getNotificationPreferences(userId = currentUserId()): Promise<NotificationPreferences> {
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  return row ? toPreferences(row) : { minimumScore: 75, minimumMargin: 2000, deliveryMode: "IMMEDIATE", quietHoursStart: null, quietHoursEnd: null, email: null };
}

export async function updateNotificationPreferences(patch: Partial<NotificationPreferences>, userId = currentUserId()): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const values = { minimumScore: patch.minimumScore ?? current.minimumScore, minimumMargin: String(patch.minimumMargin ?? current.minimumMargin), deliveryMode: patch.deliveryMode ?? current.deliveryMode, quietHoursStart: patch.quietHoursStart ?? current.quietHoursStart, quietHoursEnd: patch.quietHoursEnd ?? current.quietHoursEnd, email: patch.email ?? current.email, updatedAt: new Date() };
  const [row] = await db.update(userPreferences).set(values).where(eq(userPreferences.userId, userId)).returning();
  return row ? toPreferences(row) : current;
}
