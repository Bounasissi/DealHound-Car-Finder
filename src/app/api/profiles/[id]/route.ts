import { jsonError, jsonOk, withApi } from "@/lib/api";
import { deleteProfile, getProfile } from "@/lib/repo";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>("profiles.get", async (_req, { params }) => {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) return jsonError(404, "Profile not found");
  return jsonOk({ profile });
});

export const DELETE = withApi<Ctx>("profiles.delete", async (_req, { params }) => {
  const { id } = await params;
  const existing = await getProfile(id);
  if (!existing) return jsonError(404, "Profile not found");
  await deleteProfile(id);
  return jsonOk({ deleted: true });
});
