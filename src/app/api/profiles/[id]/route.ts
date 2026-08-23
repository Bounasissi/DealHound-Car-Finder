import { jsonError, jsonOk, withApi } from "@/lib/api";
import { profileUpdate } from "@/lib/schemas";
import { deleteProfile, getProfile, updateProfile } from "@/lib/repo";

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

export const PATCH = withApi<Ctx>("profiles.update", async (req, { params }) => {
  const { id } = await params;
  const profile = await updateProfile(id, profileUpdate.parse(await req.json()));
  if (!profile) return jsonError(404, "Profile not found");
  return jsonOk({ profile });
});
