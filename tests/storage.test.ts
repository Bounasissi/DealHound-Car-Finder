import { afterEach, describe, expect, it, vi } from "vitest";
import { readObject, storeObject, validateUpload } from "@/lib/storage";

const originalRemoteBase = process.env.OBJECT_STORAGE_BASE_URL;
const originalRemoteToken = process.env.OBJECT_STORAGE_TOKEN;

afterEach(() => {
  process.env.OBJECT_STORAGE_BASE_URL = originalRemoteBase;
  process.env.OBJECT_STORAGE_TOKEN = originalRemoteToken;
  vi.unstubAllGlobals();
});

describe("photo upload validation", () => {
  it("accepts supported image types within the limit", () => {
    expect(validateUpload({ type: "image/jpeg", size: 1024 * 1024, name: "listing.jpg" })).toEqual({ ok: true, extension: "jpg" });
  });

  it("rejects executable, oversized, and misleading uploads", () => {
    expect(validateUpload({ type: "application/javascript", size: 10, name: "x.js" }).ok).toBe(false);
    expect(validateUpload({ type: "image/png", size: 11 * 1024 * 1024, name: "x.png" }).ok).toBe(false);
    expect(validateUpload({ type: "image/png", size: 10, name: "x.jpg" }).ok).toBe(false);
  });

  it("reads an authorized object back from configured remote storage", async () => {
    process.env.OBJECT_STORAGE_BASE_URL = "https://objects.example.test";
    process.env.OBJECT_STORAGE_TOKEN = "test-token";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://objects.example.test/objects/owner-1%2Fphoto.jpg");
      expect(init?.headers).toEqual({ authorization: "Bearer test-token" });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(readObject("owner-1", "owner-1/photo.jpg")).resolves.toEqual({
      bytes: Buffer.from([1, 2, 3]),
      contentType: "image/jpeg",
    });
  });

  it("returns an authenticated application URL for remote uploads", async () => {
    process.env.OBJECT_STORAGE_BASE_URL = "https://objects.example.test";
    process.env.OBJECT_STORAGE_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ url: "https://objects.example.test/public-url" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    })));

    await expect(storeObject("owner-1", new File([new Uint8Array([1])], "photo.jpg", { type: "image/jpeg" }))).resolves.toMatchObject({
      url: expect.stringMatching(/^\/api\/uploads\/owner-1\//),
      contentType: "image/jpeg",
    });
  });

  it("does not request another owner's remote object", async () => {
    process.env.OBJECT_STORAGE_BASE_URL = "https://objects.example.test";
    process.env.OBJECT_STORAGE_TOKEN = "test-token";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(readObject("owner-2", "owner-1/photo.jpg")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
