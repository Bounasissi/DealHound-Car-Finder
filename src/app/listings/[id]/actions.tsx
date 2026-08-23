"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OUTCOME_TYPES, REPAIR_CATEGORIES, WORKFLOW_STAGES } from "@/domain/types";

interface DetailActionsProps {
  slot?: "valuation" | "history" | "title" | "issues" | "outcome";
  listingId: string;
  stage?: string;
  watched?: boolean;
  vin?: string | null;
  hardRejected?: boolean;
  hasVin?: boolean;
}

const input = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium";
const btn =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40";
const btnSecondary = "rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-40";

async function callApi(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>;
}

export default function DetailActions(props: DetailActionsProps) {
  switch (props.slot) {
    case "valuation":
      return <ValuationForm listingId={props.listingId} />;
    case "history":
      return <HistoryRun listingId={props.listingId} hasVin={props.hasVin ?? false} />;
    case "title":
      return <TitleReviewForm listingId={props.listingId} />;
    case "issues":
      return <IssueForm listingId={props.listingId} />;
    case "outcome":
      return <OutcomeForm listingId={props.listingId} />;
    default:
      return <HeaderActions {...props} />;
  }
}

function HeaderActions({ listingId, stage, watched, vin, hardRejected }: DetailActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vinValue, setVinValue] = useState("");
  const [nextStage, setNextStage] = useState("");
  const [note, setNote] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const isWatched = watched ?? false;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase text-zinc-700">
          Stage: {stage ?? "FOUND"}
        </span>
        <button
          className={btnSecondary}
          disabled={busy}
          onClick={() => run(() => callApi(`/api/listings/${listingId}`, "PATCH", { watched: !isWatched }))}
        >
          {isWatched ? "★ Watched" : "☆ Watch"}
        </button>
        {!vin && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await callApi(`/api/listings/${listingId}`, "PATCH", { vin: vinValue.trim().toUpperCase() });
                setVinValue("");
              });
            }}
          >
            <input
              value={vinValue}
              onChange={(e) => setVinValue(e.target.value.toUpperCase())}
              placeholder="Enter 17-char VIN"
              maxLength={17}
              minLength={17}
              required
              className="w-56 rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm uppercase"
            />
            <button type="submit" disabled={busy} className={btn}>
              Save VIN
            </button>
          </form>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className={label}>Advance to</label>
          <select value={nextStage} onChange={(e) => setNextStage(e.target.value)} className={input}>
            <option value="">Select stage…</option>
            {WORKFLOW_STAGES.filter((s) => s !== stage).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" maxLength={500} className={input} />
        </div>
        <button
          className={btn}
          disabled={busy || !nextStage || hardRejected}
          onClick={() =>
            run(async () => {
              await callApi(`/api/listings/${listingId}/workflow`, "POST", {
                to: nextStage,
                note: note || undefined,
              });
              setNextStage("");
              setNote("");
            })
          }
        >
          Advance
        </button>
      </div>
      {hardRejected && (
        <p className="mt-2 text-xs font-semibold text-red-600">Hard-rejected deal — workflow advancement disabled.</p>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

function ValuationForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await callApi(`/api/listings/${listingId}/valuation`, "POST", {
        provider: "manual-kbb-entry",
        referenceGoodValue: Number(value.replace(/[^0-9.]/g, "")),
      });
      setValue("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex items-end gap-2 border-t border-zinc-100 pt-3">
      <div>
        <label className={label}>KBB Good-condition value ($)</label>
        <input
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 12500"
          inputMode="numeric"
          className={input}
        />
      </div>
      <button type="submit" disabled={busy} className={btn}>
        {busy ? "Saving…" : "Add Valuation"}
      </button>
      <ErrorNote error={error} />
    </form>
  );
}

function HistoryRun({ listingId, hasVin }: { listingId: string; hasVin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <button
        className={btn}
        disabled={busy || !hasVin}
        onClick={() =>
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await callApi(`/api/listings/${listingId}/history-check`, "POST");
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          })()
        }
      >
        {busy ? "Checking…" : "Run History Check"}
      </button>
      {!hasVin && <p className="ml-2 inline text-xs text-zinc-500">Requires a VIN.</p>}
      <ErrorNote error={error} />
    </div>
  );
}

function TitleReviewForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [state, setState] = useState("DOCUMENT_REVIEWED");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await callApi(`/api/listings/${listingId}/title-verification`, "POST", { state, evidenceNote });
      setEvidenceNote(""); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
    <p className="text-xs text-zinc-500">Manual review records what you observed; it does not turn a seller claim into authoritative history.</p>
    <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <div><label className={label}>Status</label><select value={state} onChange={(e) => setState(e.target.value)} className={input}>
        <option value="DOCUMENT_REVIEWED">Document reviewed</option><option value="SELLER_CLAIMS_CLEAN">Seller claims clean</option><option value="UNKNOWN">Verification incomplete</option>
      </select></div>
      <div><label className={label}>Evidence note</label><input required value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} placeholder="e.g. seller sent photo of NJ title; not independently verified" className={input} /></div>
      <button type="submit" disabled={busy} className={btn}>{busy ? "Saving…" : "Save title note"}</button>
    </div>
    <ErrorNote error={error} />
  </form>;
}

function IssueForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    category: (typeof REPAIR_CATEGORIES)[number];
    description: string;
    severity: string;
    estimateExpected: string;
    majorRisk: boolean;
  }>({
    category: REPAIR_CATEGORIES[0],
    description: "",
    severity: "MODERATE",
    estimateExpected: "",
    majorRisk: false,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await callApi(`/api/listings/${listingId}/issues`, "POST", {
        category: form.category,
        description: form.description,
        severity: form.severity,
        estimateExpected: Number(form.estimateExpected),
        majorRisk: form.majorRisk,
      });
      setForm({ ...form, description: "", estimateExpected: "", majorRisk: false });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className={label}>Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as (typeof REPAIR_CATEGORIES)[number] })}
            className={input}
          >
            {REPAIR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Severity</label>
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className={input}>
            {["LOW", "MODERATE", "HIGH", "CRITICAL"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Expected cost ($)</label>
          <input
            required
            type="number"
            min={0}
            value={form.estimateExpected}
            onChange={(e) => setForm({ ...form, estimateExpected: e.target.value })}
            className={input}
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.majorRisk}
              onChange={(e) => setForm({ ...form, majorRisk: e.target.checked })}
            />
            Major risk
          </label>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className={label}>Finding</label>
          <input
            required
            minLength={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Left front strut knocking over bumps"
            className={input}
          />
        </div>
        <button type="submit" disabled={busy} className={btn}>
          {busy ? "Adding…" : "Add Finding"}
        </button>
      </div>
      <ErrorNote error={error} />
    </form>
  );
}

function OutcomeForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState<{
    outcome: (typeof OUTCOME_TYPES)[number];
    notes: string;
    actualRepairs: string;
    actualFinishedValue: string;
    soldPrice: string;
  }>({
    outcome: OUTCOME_TYPES[0],
    notes: "",
    actualRepairs: "",
    actualFinishedValue: "",
    soldPrice: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const purchased = form.outcome === "PURCHASED";
      await callApi(`/api/listings/${listingId}/outcome`, "POST", {
        outcome: form.outcome,
        notes: form.notes || undefined,
        purchase: purchased
          ? {
              actualRepairs: Number(form.actualRepairs),
              actualFinishedValue: form.actualFinishedValue ? Number(form.actualFinishedValue) : null,
              soldPrice: form.soldPrice ? Number(form.soldPrice) : null,
            }
          : undefined,
      });
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="text-sm text-emerald-700">Outcome recorded.</p>;

  const purchased = form.outcome === "PURCHASED";

  return (
    <form onSubmit={submit} className="space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className={label}>Outcome</label>
          <select
            value={form.outcome}
            onChange={(e) => setForm({ ...form, outcome: e.target.value as (typeof OUTCOME_TYPES)[number] })}
            className={input}
          >
            {OUTCOME_TYPES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        {purchased && (
          <>
            <div>
              <label className={label}>Actual repairs ($)</label>
              <input
                required
                type="number"
                min={0}
                value={form.actualRepairs}
                onChange={(e) => setForm({ ...form, actualRepairs: e.target.value })}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Finished value ($)</label>
              <input
                type="number"
                min={0}
                value={form.actualFinishedValue}
                onChange={(e) => setForm({ ...form, actualFinishedValue: e.target.value })}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Sold price ($)</label>
              <input
                type="number"
                min={0}
                value={form.soldPrice}
                onChange={(e) => setForm({ ...form, soldPrice: e.target.value })}
                className={input}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className={label}>Notes</label>
          <textarea
            rows={2}
            maxLength={2000}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={input}
          />
        </div>
        <button type="submit" disabled={busy} className={btn}>
          {busy ? "Recording…" : "Record Outcome"}
        </button>
      </div>
      <ErrorNote error={error} />
    </form>
  );
}
