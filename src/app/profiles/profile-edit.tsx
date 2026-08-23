"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProfileEdit({ id, name, ratio, active }: { id: string; name: string; ratio: number; active: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name, ratio: String(ratio), active });
  if (!editing) return <button className="rounded border px-2 py-1 text-xs hover:bg-zinc-50" onClick={() => setEditing(true)}>Edit</button>;
  return <form className="flex flex-wrap items-center gap-2" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true);
    const response = await fetch(`/api/profiles/${id}`, { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.name, maxAskingRatio: Number(form.ratio), active: form.active }) });
    setBusy(false);
    if (response.ok) { setEditing(false); router.refresh(); }
  }}>
    <input aria-label="Profile name" className="rounded border px-2 py-1 text-xs" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
    <input aria-label="Maximum asking ratio" type="number" min="0.1" max="1" step="0.01" className="w-20 rounded border px-2 py-1 text-xs" value={form.ratio} onChange={(e) => setForm({ ...form, ratio: e.target.value })} />
    <label className="text-xs"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> active</label>
    <button disabled={busy} className="rounded bg-zinc-900 px-2 py-1 text-xs text-white">Save</button>
    <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setEditing(false)}>Cancel</button>
  </form>;
}
