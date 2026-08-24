"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Inspection = { id: string; status: string; scheduledAt: string | null; findings: string[]; notes: string | null; createdAt: string };
type Offer = { id: string; amount: number; status: string; notes: string | null; madeAt: string; respondedAt: string | null };
type Interaction = { id: string; type: string; body: string; occurredAt: string };

export default function WorkflowRecords({ listingId, inspections, offers, interactions }: { listingId: string; inspections: Inspection[]; offers: Offer[]; interactions: Interaction[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(url: string, body: unknown) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  }

  return <section className="rounded-lg border bg-white p-5 shadow-sm">
    <h2 className="font-semibold">Seller, inspection & offer trail</h2>
    <p className="mt-1 text-xs text-zinc-500">Record evidence and commitments separately from the underwriting snapshot.</p>
    <div className="mt-4 grid gap-5 lg:grid-cols-3">
      <RecordForm title="Seller interaction" onSubmit={(body) => submit(`/api/listings/${listingId}/interactions`, body)} busy={busy}>
        <select name="type" defaultValue="MESSAGE" className={input}><option>MESSAGE</option><option>CALL</option><option>MEETING</option><option>QUESTION</option><option>OTHER</option></select>
        <textarea name="body" required minLength={1} maxLength={4000} placeholder="Seller said…" className={input} />
      </RecordForm>
      <RecordForm title="Inspection" onSubmit={(body) => submit(`/api/listings/${listingId}/inspections`, body)} busy={busy}>
        <select name="status" defaultValue="SCHEDULED" className={input}><option>SCHEDULED</option><option>IN_PROGRESS</option><option>PASSED</option><option>FAILED</option><option>CANCELLED</option></select>
        <input name="scheduledAt" type="datetime-local" className={input} />
        <textarea name="findings" placeholder="One finding per line" className={input} />
        <textarea name="notes" maxLength={2000} placeholder="Inspection notes" className={input} />
      </RecordForm>
      <RecordForm title="Offer" onSubmit={(body) => submit(`/api/listings/${listingId}/offers`, body)} busy={busy}>
        <input name="amount" required type="number" min="1" step="0.01" placeholder="Offer amount" className={input} />
        <select name="status" defaultValue="DRAFT" className={input}><option>DRAFT</option><option>SENT</option><option>COUNTERED</option><option>ACCEPTED</option><option>DECLINED</option><option>EXPIRED</option></select>
        <textarea name="notes" maxLength={2000} placeholder="Offer terms / response" className={input} />
      </RecordForm>
    </div>
    {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 grid gap-4 text-sm md:grid-cols-3">
      <RecordList title="Interactions" items={interactions.map((item) => `${item.type}: ${item.body}`)} empty="No seller interactions" />
      <RecordList title="Inspections" items={inspections.map((item) => `${item.status}: ${item.findings.join(", ") || item.notes || "No findings"}`)} empty="No inspections" />
      <RecordList title="Offers" items={offers.map((item) => `$${item.amount.toLocaleString()} · ${item.status}${item.notes ? ` · ${item.notes}` : ""}`)} empty="No offers" />
    </div>
  </section>;
}

const input = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";

function RecordForm({ title, children, onSubmit, busy }: { title: string; children: React.ReactNode; onSubmit: (body: Record<string, unknown>) => void; busy: boolean }) {
  return <form className="space-y-2" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form.entries());
    if (typeof body.findings === "string") body.findings = body.findings.split("\n").map((value) => value.trim()).filter(Boolean);
    if (typeof body.amount === "string") body.amount = Number(body.amount);
    if (body.scheduledAt === "") body.scheduledAt = null;
    else if (typeof body.scheduledAt === "string") body.scheduledAt = new Date(body.scheduledAt).toISOString();
    onSubmit(body);
    event.currentTarget.reset();
  }}>
    <h3 className="text-sm font-semibold">{title}</h3>
    {children}
    <button disabled={busy} className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : "Save record"}</button>
  </form>;
}

function RecordList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <div><h3 className="font-medium">{title}</h3>{items.length ? <ul className="mt-2 space-y-1 text-xs text-zinc-600">{items.slice(0, 8).map((item, index) => <li key={`${item}-${index}`} className="rounded bg-zinc-50 p-2">{item}</li>)}</ul> : <p className="mt-2 text-xs text-zinc-400">{empty}</p>}</div>;
}
