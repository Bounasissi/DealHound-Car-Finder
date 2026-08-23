import { jsonOk, withApi } from "@/lib/api";
import { profileInput } from "@/lib/schemas";
import { createProfile, listProfiles } from "@/lib/repo";

export const GET = withApi("profiles.list", async (req) => {
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") === "true";
  const profiles = await listProfiles(activeOnly);
  return jsonOk({ profiles });
});

export const POST = withApi("profiles.create", async (req) => {
  const body = profileInput.parse(await req.json());
  const profile = await createProfile({ ...body });
  return jsonOk({ profile }, { status: 201 });
});
