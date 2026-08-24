import { jsonError, withApi } from "@/lib/api";
import { currentUserId } from "@/lib/auth";
import { readObject } from "@/lib/storage";

type Ctx = { params: Promise<{ key: string[] }> };

export const GET = withApi<Ctx>("uploads.get", async (_req, { params }) => {
  const { key: segments } = await params;
  const key = segments.join("/");
  const object = await readObject(currentUserId(), key);
  if (!object) return jsonError(404, "Upload not found");
  return new Response(new Uint8Array(object.bytes), { headers: { "content-type": object.contentType, "cache-control": "private, max-age=3600" } });
});
