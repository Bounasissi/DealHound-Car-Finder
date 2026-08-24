"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REPAIR_CATEGORIES } from "@/domain/types";

export default function ProfileForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    zip: "08054",
    radiusMiles: "100",
    make: "",
    model: "",
    trim: "",
    yearMin: "",
    yearMax: "",
    mileageMax: "",
    priceMin: "",
    priceMax: "",
    maxAskingRatio: "0.70",
    requireKbbReference: true,
    maxAllInRatio: "0.80",
    requireCleanTitle: true,
    requireRepairEvidence: true,
    allowed: [] as string[],
    maxExpectedRepairs: "",
    minDealMargin: "2000",
    maxFraudRiskScore: "40",
    rejected: ["ENGINE_MAJOR", "TRANSMISSION_MAJOR", "RUST_FRAME_FLOOD_FIRE"] as string[],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          zip: form.zip,
          radiusMiles: Number(form.radiusMiles),
          make: form.make || null,
          model: form.model || null,
          trim: form.trim || null,
          yearMin: form.yearMin ? Number(form.yearMin) : null,
          yearMax: form.yearMax ? Number(form.yearMax) : null,
          mileageMax: form.mileageMax ? Number(form.mileageMax) : null,
          priceMin: form.priceMin ? Number(form.priceMin.replace(/[^0-9]/g, "")) : null,
          priceMax: form.priceMax ? Number(form.priceMax.replace(/[^0-9]/g, "")) : null,
          maxAskingRatio: Number(form.maxAskingRatio),
          requireKbbReference: form.requireKbbReference,
          maxAllInRatio: Number(form.maxAllInRatio),
          requireCleanTitle: form.requireCleanTitle,
          requireRepairEvidence: form.requireRepairEvidence,
          allowedRepairCategories: form.allowed,
          rejectedRepairCategories: form.rejected,
          maxExpectedRepairs: form.maxExpectedRepairs ? Number(form.maxExpectedRepairs.replace(/[^0-9]/g, "")) : null,
          minDealMargin: Number(form.minDealMargin),
          maxFraudRiskScore: Number(form.maxFraudRiskScore),
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        + New Search Profile
      </button>
    );
  }

  const input = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium";

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={label}>Profile name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cheap commuters" className={input} />
        </div>
        <div>
          <label className={label}>ZIP</label>
          <input required value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} maxLength={5} className={input} />
        </div>
        <div>
          <label className={label}>Radius (miles)</label>
          <input type="number" value={form.radiusMiles} onChange={(e) => setForm({ ...form, radiusMiles: e.target.value })} className={input} />
        </div>
        <div>
          <label className={label}>Make</label>
          <input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="any" className={input} />
        </div>
        <div>
          <label className={label}>Model</label>
          <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="any" className={input} />
        </div>
        <div>
          <label className={label}>Trim</label>
          <input value={form.trim} onChange={(e) => setForm({ ...form, trim: e.target.value })} placeholder="any" className={input} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-2">
          <div>
            <label className={label}>Year min</label>
            <input type="number" value={form.yearMin} onChange={(e) => setForm({ ...form, yearMin: e.target.value })} className={input} />
          </div>
          <div>
            <label className={label}>Year max</label>
            <input type="number" value={form.yearMax} onChange={(e) => setForm({ ...form, yearMax: e.target.value })} className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Max mileage</label>
          <input type="number" value={form.mileageMax} onChange={(e) => setForm({ ...form, mileageMax: e.target.value })} className={input} />
        </div>
        <div>
          <label className={label}>Min price ($)</label>
          <input value={form.priceMin} onChange={(e) => setForm({ ...form, priceMin: e.target.value })} className={input} />
        </div>
        <div>
          <label className={label}>Max price ($)</label>
          <input value={form.priceMax} onChange={(e) => setForm({ ...form, priceMax: e.target.value })} className={input} />
        </div>
        <div>
          <label className={label}>Max asking/KBB Good ratio</label>
          <input value={form.maxAskingRatio} onChange={(e) => setForm({ ...form, maxAskingRatio: e.target.value })} className={input} />
        </div>
        <div>
          <label className={label}>Max all-in/value ratio</label>
          <input value={form.maxAllInRatio} onChange={(e) => setForm({ ...form, maxAllInRatio: e.target.value })} className={input} />
        </div>
        <div>
          <label className={label}>Max expected repairs ($)</label>
          <input type="number" min="0" value={form.maxExpectedRepairs} onChange={(e) => setForm({ ...form, maxExpectedRepairs: e.target.value })} placeholder="any" className={input} />
        </div>
        <div>
          <label className={label}>Min deal margin ($)</label>
          <input type="number" value={form.minDealMargin} onChange={(e) => setForm({ ...form, minDealMargin: e.target.value })} className={input} />
        </div>
        <div>
          <label className={label}>Max fraud risk score</label>
          <input type="number" value={form.maxFraudRiskScore} onChange={(e) => setForm({ ...form, maxFraudRiskScore: e.target.value })} className={input} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requireKbbReference} onChange={(e) => setForm({ ...form, requireKbbReference: e.target.checked })} />
            Require KBB Good benchmark (proxy/comps stay exploratory)
          </label>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requireCleanTitle} onChange={(e) => setForm({ ...form, requireCleanTitle: e.target.checked })} />
            Require clean title (history-checked)
          </label>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requireRepairEvidence} onChange={(e) => setForm({ ...form, requireRepairEvidence: e.target.checked })} />
            Require repair evidence (needs work)
          </label>
        </div>
      </div>

      <fieldset>
        <legend className={label}>Allowed repair categories (optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {REPAIR_CATEGORIES.map((cat) => (
            <label key={cat} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${form.allowed.includes(cat) ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-zinc-300 bg-white text-zinc-600"}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={form.allowed.includes(cat)}
                onChange={(e) => setForm({ ...form, allowed: e.target.checked ? [...form.allowed, cat] : form.allowed.filter((c) => c !== cat) })}
              />
              {cat}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>Auto-reject repair categories</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {REPAIR_CATEGORIES.map((cat) => (
            <label key={cat} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${form.rejected.includes(cat) ? "border-red-300 bg-red-50 text-red-700" : "border-zinc-300 bg-white text-zinc-600"}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={form.rejected.includes(cat)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rejected: e.target.checked ? [...form.rejected, cat] : form.rejected.filter((c) => c !== cat),
                  })
                }
              />
              {cat}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40">
          {busy ? "Creating…" : "Create Profile"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
