"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function IngestPage() {
  const router = useRouter();
  const [pastedText, setPastedText] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [kbbGoodValue, setKbbGoodValue] = useState("");
  const [mileage, setMileage] = useState("");
  const [vin, setVin] = useState("");
  const [location, setLocation] = useState("");
  const [screenshotNotes, setScreenshotNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [csv, setCsv] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        pastedText: pastedText || undefined,
        url: url || undefined,
        ...(kbbGoodValue ? { kbbGoodValue: Number(kbbGoodValue.replace(/[^0-9.]/g, "")) } : {}),
        screenshotNotes: screenshotNotes ? screenshotNotes.split("\n").filter(Boolean) : undefined,
        overrides: {
          ...(price ? { price: Number(price.replace(/[^0-9.]/g, "")) } : {}),
          ...(mileage ? { mileage: Number(mileage.replace(/[^0-9]/g, "")) } : {}),
          ...(vin.trim().length === 17 ? { vin: vin.trim().toUpperCase() } : {}),
          ...(location ? { location } : {}),
        },
      };
      const res = await fetch("/api/listings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      for (const photo of photos) {
        const upload = new FormData(); upload.set("file", photo); upload.set("note", "Marketplace screenshot");
        const photoResponse = await fetch(`/api/listings/${data.listing.id}/photos`, { method: "POST", credentials: "same-origin", body: upload });
        if (!photoResponse.ok) throw new Error((await photoResponse.json().catch(() => null))?.error ?? "Screenshot upload failed");
      }
      router.push(`/listings/${data.listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function submitCsv(e: React.FormEvent) {
    e.preventDefault(); setCsvBusy(true); setCsvError(null);
    try {
      const res = await fetch("/api/listings/import", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setCsv(""); router.push("/");
    } catch (err) { setCsvError(err instanceof Error ? err.message : String(err)); }
    finally { setCsvBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ingest Listing</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Paste a Facebook Marketplace listing (title, description, price, mileage). DealHound parses
          what it can — your explicit entries always win. No scraping: you bring the content.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <label className="block text-sm font-medium">Pasted listing text</label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={8}
            placeholder={"2014 Honda Accord EX\n$11,500\n115k miles\nClean title in hand\nNeeds new tires, AC blows warm\nLocated in Mount Laurel, NJ"}
            className="mt-1 w-full rounded-md border border-zinc-300 p-3 font-mono text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Listing URL (optional)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://facebook.com/marketplace/item/…"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium">VIN (if shown)</label>
            <input value={vin} onChange={(e) => setVin(e.target.value)} maxLength={17} placeholder="17 characters"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm uppercase" />
          </div>
          <div>
            <label className="block text-sm font-medium">Price override</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$11,500"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium">KBB Good-condition value</label>
            <input value={kbbGoodValue} onChange={(e) => setKbbGoodValue(e.target.value)} placeholder="$15,000" inputMode="numeric"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-zinc-500">Required for the default KBB-qualified deal lane; leave blank only for exploratory/manual-review mode.</p>
          </div>
          <div>
            <label className="block text-sm font-medium">Mileage override</label>
            <input value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="115000"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Location override</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Mount Laurel, NJ"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Marketplace screenshots</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-zinc-500">JPEG, PNG, or WebP; up to 10 MB each. Screenshots stay private to your account.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Screenshot observations (one per line)</label>
            <textarea value={screenshotNotes} onChange={(e) => setScreenshotNotes(e.target.value)} rows={3}
              placeholder={"odometer shows 98k\ncheck engine light visible"}
              className="mt-1 w-full rounded-md border border-zinc-300 p-3 text-sm" />
          </div>
        </div>

        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={busy || (!pastedText && !url && photos.length === 0)}
          className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          {busy ? "Evaluating…" : "Ingest & Evaluate"}
        </button>
      </form>

      <form onSubmit={submitCsv} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="font-semibold">Import a CSV export</h2>
          <p className="mt-1 text-sm text-zinc-600">User-provided data only. Supported columns include title, description, price, kbbGoodValue, mileage, VIN, year, make, model, trim, location, seller, and contact.</p>
        </div>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={7} placeholder={'title,price,mileage,year,make,model,location\n2015 Honda Accord,11500,98000,2015,Honda,Accord,"Mount Laurel, NJ"'} className="w-full rounded-md border border-zinc-300 p-3 font-mono text-sm" />
        {csvError && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{csvError}</p>}
        <button type="submit" disabled={csvBusy || !csv.trim()} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-40">{csvBusy ? "Importing…" : "Import CSV & Evaluate"}</button>
      </form>
    </div>
  );
}
