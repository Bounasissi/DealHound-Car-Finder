import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  alerts,
  evaluations,
  historyChecks,
  inspections,
  invitations,
  jobs,
  listingFeedback,
  listings,
  notificationDeliveries,
  offers,
  outcomes,
  passwordResetTokens,
  searchProfiles,
  sellerInteractions,
  sessions,
  usageCounters,
  userIssues,
  users,
  userPreferences,
  valuations,
} from "@/db/schema";
import { createOpaqueToken, hashOpaqueToken, hashPassword } from "./passwords";

export type UserRole = "OWNER" | "USER";

export interface IdentityUser {
  id: string;
  email: string;
  role: UserRole;
  status: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toUser(row: typeof users.$inferSelect): IdentityUser {
  return { id: row.id, email: row.email, role: row.role === "OWNER" ? "OWNER" : "USER", status: row.status };
}

export async function findUserByEmail(email: string): Promise<(IdentityUser & { passwordHash: string }) | null> {
  const [row] = await db.select().from(users).where(eq(users.email, normalizeEmail(email)));
  return row ? { ...toUser(row), passwordHash: row.passwordHash } : null;
}

export async function createUser(email: string, password: string, role: UserRole = "USER"): Promise<IdentityUser> {
  const normalized = normalizeEmail(email);
  const [row] = await db.insert(users).values({ email: normalized, passwordHash: await hashPassword(password), role }).returning();
  await db.insert(userPreferences).values({ userId: row.id, email: normalized });
  return toUser(row);
}

export async function countUsers(): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users);
  return rows.length;
}

export async function createSession(userId: string, ttlHours = 8): Promise<{ token: string; expiresAt: Date }> {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await db.insert(sessions).values({ userId, tokenHash: hashOpaqueToken(token), expiresAt });
  return { token, expiresAt };
}

export async function resolveSession(token: string): Promise<(IdentityUser & { sessionId: string }) | null> {
  if (!token) return null;
  const now = new Date();
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashOpaqueToken(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)));
  if (!row || row.user.status !== "ACTIVE") return null;
  return { ...toUser(row.user), sessionId: row.session.id };
}

export async function revokeSession(token: string): Promise<void> {
  if (!token) return;
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashOpaqueToken(token)));
}

export async function createInvitation(email: string, role: UserRole, invitedBy: string, ttlHours = 72): Promise<{ token: string; expiresAt: Date }> {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await db.insert(invitations).values({ email: normalizeEmail(email), role, invitedBy, tokenHash: hashOpaqueToken(token), expiresAt });
  return { token, expiresAt };
}

export async function acceptInvitation(token: string, password: string, expectedEmail?: string): Promise<IdentityUser | null> {
  const now = new Date();
  const [invite] = await db.select().from(invitations).where(and(eq(invitations.tokenHash, hashOpaqueToken(token)), isNull(invitations.acceptedAt), gt(invitations.expiresAt, now)));
  if (!invite) return null;
  if (expectedEmail && invite.email !== normalizeEmail(expectedEmail)) return null;
  const existing = await findUserByEmail(invite.email);
  if (existing) return null;
  const user = await createUser(invite.email, password, invite.role === "OWNER" ? "OWNER" : "USER");
  await db.update(invitations).set({ acceptedAt: now }).where(eq(invitations.id, invite.id));
  return user;
}

export async function createPasswordReset(email: string, ttlHours = 1): Promise<{ token: string; expiresAt: Date } | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashOpaqueToken(token), expiresAt });
  return { token, expiresAt };
}

export async function resetPassword(token: string, password: string): Promise<boolean> {
  const now = new Date();
  const [reset] = await db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, hashOpaqueToken(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)));
  if (!reset) return false;
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(password), updatedAt: now }).where(eq(users.id, reset.userId));
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, reset.id));
    await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, reset.userId), isNull(sessions.revokedAt)));
  });
  return true;
}

export async function deleteUserAccount(userId: string): Promise<void> {
  // Tenant-owned records use owner_id text without a foreign key for legacy compatibility.
  await db.transaction(async (tx) => {
    await tx.delete(usageCounters).where(eq(usageCounters.ownerId, userId));
    await tx.delete(jobs).where(eq(jobs.ownerId, userId));
    await tx.delete(notificationDeliveries).where(eq(notificationDeliveries.ownerId, userId));
    await tx.delete(listingFeedback).where(eq(listingFeedback.ownerId, userId));
    await tx.delete(inspections).where(eq(inspections.ownerId, userId));
    await tx.delete(offers).where(eq(offers.ownerId, userId));
    await tx.delete(sellerInteractions).where(eq(sellerInteractions.ownerId, userId));
    await tx.delete(alerts).where(eq(alerts.ownerId, userId));
    await tx.delete(outcomes).where(eq(outcomes.ownerId, userId));
    await tx.delete(evaluations).where(eq(evaluations.ownerId, userId));
    await tx.delete(userIssues).where(eq(userIssues.ownerId, userId));
    await tx.delete(historyChecks).where(eq(historyChecks.ownerId, userId));
    await tx.delete(valuations).where(eq(valuations.ownerId, userId));
    await tx.delete(listings).where(eq(listings.ownerId, userId));
    await tx.delete(searchProfiles).where(eq(searchProfiles.ownerId, userId));
    await tx.delete(userPreferences).where(eq(userPreferences.userId, userId));
    await tx.delete(invitations).where(eq(invitations.invitedBy, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
