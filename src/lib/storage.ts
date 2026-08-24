import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createOpaqueToken } from "./passwords";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function validateUpload(input: { type: string; size: number; name: string }): { ok: true; extension: string } | { ok: false; error: string } {
  const extension = MIME_EXTENSIONS[input.type.toLowerCase()];
  if (!extension) return { ok: false, error: "Only JPEG, PNG, and WebP images are accepted" };
  if (input.size <= 0 || input.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Image must be between 1 byte and 10 MB" };
  const suppliedExtension = path.extname(input.name).slice(1).toLowerCase();
  if (suppliedExtension !== extension && !(extension === "jpg" && suppliedExtension === "jpeg")) return { ok: false, error: "File extension does not match MIME type" };
  return { ok: true, extension };
}

export async function storeObject(ownerId: string, file: File): Promise<{ key: string; url: string; contentType: string }> {
  const valid = validateUpload({ type: file.type, size: file.size, name: file.name });
  if (!valid.ok) throw new Error(valid.error);
  const key = `${ownerId}/${createOpaqueToken(18)}.${valid.extension}`;
  const remoteBase = process.env.OBJECT_STORAGE_BASE_URL;
  if (remoteBase && process.env.OBJECT_STORAGE_TOKEN) {
    const response = await fetch(`${remoteBase.replace(/\/$/, "")}/objects/${encodeURIComponent(key)}`, { method: "PUT", headers: { authorization: `Bearer ${process.env.OBJECT_STORAGE_TOKEN}`, "content-type": file.type }, body: await file.arrayBuffer() });
    if (!response.ok) throw new Error(`Object storage returned HTTP ${response.status}`);
    const body = await response.json().catch(() => ({})) as { url?: string };
    return { key, url: body.url ?? `${remoteBase.replace(/\/$/, "")}/objects/${encodeURIComponent(key)}`, contentType: file.type };
  }
  const root = path.resolve(process.env.LOCAL_UPLOAD_DIR ?? path.join(process.cwd(), ".uploads"));
  const target = path.join(root, key);
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid upload path");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  return { key, url: `/api/uploads/${key}`, contentType: file.type };
}

export async function readObject(ownerId: string, key: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!key.startsWith(`${ownerId}/`) || key.includes("..")) return null;
  const root = path.resolve(process.env.LOCAL_UPLOAD_DIR ?? path.join(process.cwd(), ".uploads"));
  const target = path.join(root, key);
  if (!target.startsWith(`${root}${path.sep}`)) return null;
  try {
    const bytes = await readFile(target);
    const extension = path.extname(target).slice(1);
    return { bytes, contentType: Object.entries(MIME_EXTENSIONS).find(([, value]) => value === extension)?.[0] ?? "application/octet-stream" };
  } catch { return null; }
}
