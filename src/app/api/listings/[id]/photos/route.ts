import { jsonError, jsonOk, withApi } from "@/lib/api";
import { currentUserId } from "@/lib/auth";
import { appendListingPhoto, hasOwnedListing } from "@/lib/repo";
import { storeObject } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApi<Ctx>("listings.photos.upload", async (req, { params }) => {
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file");
  const note = form.get("note");
  if (!(file instanceof File)) return jsonError(422, "An image file is required");
  if (!(await hasOwnedListing(id))) return jsonError(404, "Listing not found");
  try {
    const stored = await storeObject(currentUserId(), file);
    if (!(await appendListingPhoto(id, { url: stored.url, note: typeof note === "string" ? note.slice(0, 500) : undefined }))) return jsonError(404, "Listing not found");
    return jsonOk({ photo: stored }, { status: 201 });
  } catch (error) {
    return jsonError(422, error instanceof Error ? error.message : "Upload failed");
  }
});
