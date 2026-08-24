"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { isAuthoritativeCleanTitle } from "@/domain/title";
import { CLASS_STYLES, money, pct } from "@/lib/format";
import { filterDeals, type DealFilter, type DealInboxItem } from "@/lib/deal-filters";

type InboxProfileDefaults = Pick<DealFilter, "maxAskingRatio" | "title" | "needsWork" | "maxExpectedRepairs">;

const DEFAULT_PROFILE_DEFAULTS: InboxProfileDefaults = {
  maxAskingRatio: 0.7,
  title: "history-clean",
  needsWork: true,
  maxExpectedRepairs: null,
};

const inputClass = "w-full rounded-xl border border-[#d9d4ca] bg-[#fbfaf7] px-3 py-2.5 text-sm text-[#1d2924] outline-none transition placeholder:text-[#9a9e96] focus:border-[#284d40] focus:ring-2 focus:ring-[#284d40]/10";

export default function DealInboxClient({ initialItems, profileDefaults }: { initialItems: DealInboxItem[]; profileDefaults?: InboxProfileDefaults }) {
  const defaults = profileDefaults ?? DEFAULT_PROFILE_DEFAULTS;
  const defaultFilter = useMemo<DealFilter>(() => ({
    query: "",
    ...defaults,
    includeHardRejected: false,
    minScore: null,
    sort: "best",
  }), [defaults]);
  const [filter, setFilter] = useState<DealFilter>(() => defaultFilter);
  const visibleItems = useMemo(() => filterDeals(initialItems, filter), [initialItems, filter]);
  const cleanCount = initialItems.filter((item) => item.titleState ? isAuthoritativeCleanTitle(item.titleState) : false).length;
  const repairCount = initialItems.filter((item) => item.hasRepairEvidence).length;
  const averageDiscount = average(initialItems.map((item) => item.discountPct));

  function updateFilter(patch: Partial<DealFilter>) {
    setFilter((current) => ({ ...current, ...patch }));
  }

  function resetFilters() {
    setFilter(defaultFilter);
  }

  return (
    <div className="space-y-7 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#19392f] px-6 py-8 text-[#f5f1e8] shadow-[0_24px_60px_rgba(25,57,47,0.16)] sm:px-10 sm:py-10">
        <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full border border-[#b9d3a8]/20" />
        <div className="absolute -right-6 -top-14 h-56 w-56 rounded-full border border-[#b9d3a8]/20" />
        <div className="relative max-w-3xl">
          <p className="eyebrow text-[#b9d3a8]">DealHound / marketplace radar</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl">Find the fixers with room to win.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#d5e0d5] sm:text-lg">
            Surface Facebook Marketplace cars priced at a real discount to a Good-condition reference, then pressure-test title, repair cost, and margin before you drive out.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/ingest" className="rounded-full bg-[#c6e49d] px-5 py-3 text-sm font-semibold text-[#19392f] transition hover:bg-[#d9f0b9]">Add a Marketplace listing</Link>
            <Link href="/profiles" className="rounded-full border border-[#b9d3a8]/40 px-5 py-3 text-sm font-semibold text-[#f5f1e8] transition hover:bg-white/10">Tune search profile</Link>
          </div>
        </div>
        <div className="relative mt-9 flex flex-wrap gap-2 text-xs font-medium text-[#d5e0d5]">
          <span className="rounded-full border border-[#b9d3a8]/30 px-3 py-1.5">Target ≤ 70% of Good value</span>
          <span className="rounded-full border border-[#b9d3a8]/30 px-3 py-1.5">History-clean by default</span>
          <span className="rounded-full border border-[#b9d3a8]/30 px-3 py-1.5">Repair evidence required</span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label={filter.includeHardRejected ? "Visible listings" : "Qualified now"} value={String(visibleItems.length)} detail={`of ${initialItems.length} imported`} tone="green" />
        <Stat label="Avg. discount" value={averageDiscount === null ? "—" : `${Math.round(averageDiscount)}%`} detail="vs Good reference" tone="lime" />
        <Stat label="History-clean" value={String(cleanCount)} detail="needs verification before purchase" tone="cream" />
        <Stat label="Repair candidates" value={String(repairCount)} detail="explicit issue evidence" tone="cream" />
      </section>

      <section className="rounded-[1.5rem] border border-[#ded9cf] bg-[#fffdf8] p-4 shadow-[0_10px_30px_rgba(45,40,30,0.04)] sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow text-[#6d766c]">Search controls</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Your deal lane</h2>
          </div>
          <button type="button" onClick={resetFilters} className="text-xs font-semibold text-[#35604d] underline decoration-[#b9d3a8] underline-offset-4 hover:text-[#19392f]">Reset filters</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.6fr_0.9fr_0.9fr_1fr]">
          <label className="block">
            <span className="field-label">Search make, model, location</span>
            <input value={filter.query} onChange={(event) => updateFilter({ query: event.target.value })} className={inputClass} placeholder="e.g. Accord, Tacoma, 08054" />
          </label>
          <label className="block">
            <span className="field-label">Max ask / Good value</span>
            <select value={filter.maxAskingRatio ?? "any"} onChange={(event) => updateFilter({ maxAskingRatio: event.target.value === "any" ? null : Number(event.target.value) })} className={inputClass}>
              <option value="0.5">≤ 50%</option>
              <option value="0.6">≤ 60%</option>
              <option value="0.7">≤ 70%</option>
              <option value="0.8">≤ 80%</option>
              <option value="any">Any ratio</option>
            </select>
          </label>
          <label className="block">
            <span className="field-label">Title evidence</span>
            <select value={filter.title} onChange={(event) => updateFilter({ title: event.target.value as DealFilter["title"] })} className={inputClass}>
              <option value="history-clean">History-verified</option>
              <option value="seller-claim">Seller claims clean</option>
              <option value="any">Any title state</option>
            </select>
          </label>
          <label className="block">
            <span className="field-label">Sort by</span>
            <select value={filter.sort} onChange={(event) => updateFilter({ sort: event.target.value as DealFilter["sort"] })} className={inputClass}>
              <option value="best">Best discount first</option>
              <option value="score">Deal score</option>
              <option value="recent">Recently seen</option>
              <option value="price">Lowest asking</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#ece8df] pt-3">
          <label className="flex items-center gap-2 text-sm font-medium text-[#354238]">
            <input type="checkbox" checked={filter.needsWork} onChange={(event) => updateFilter({ needsWork: event.target.checked })} className="h-4 w-4 accent-[#35604d]" />
            Needs work / repair evidence
          </label>
          <label className="flex items-center gap-2 text-sm text-[#657066]">
            <input type="checkbox" checked={filter.includeHardRejected} onChange={(event) => updateFilter({ includeHardRejected: event.target.checked })} className="h-4 w-4 accent-[#8a3b2c]" />
            Show hard rejects
          </label>
          <label className="flex items-center gap-2 text-sm text-[#657066]">
            <span>Max repairs</span>
            <input value={filter.maxExpectedRepairs ?? ""} onChange={(event) => updateFilter({ maxExpectedRepairs: event.target.value ? Number(event.target.value) : null })} className="w-24 rounded-lg border border-[#d9d4ca] bg-[#fbfaf7] px-2.5 py-1.5 text-sm" inputMode="numeric" placeholder="Any" />
          </label>
          <label className="flex items-center gap-2 text-sm text-[#657066]">
            <span>Min score</span>
            <input value={filter.minScore ?? ""} onChange={(event) => updateFilter({ minScore: event.target.value ? Number(event.target.value) : null })} className="w-20 rounded-lg border border-[#d9d4ca] bg-[#fbfaf7] px-2.5 py-1.5 text-sm" inputMode="numeric" placeholder="Any" />
          </label>
          <span className="ml-auto text-xs text-[#7d857b]">Filters update instantly · {visibleItems.length} match{visibleItems.length === 1 ? "" : "es"}</span>
        </div>
      </section>

      {initialItems.length === 0 ? (
        <EmptyState title="Your radar is empty" body="Paste a Facebook Marketplace listing or import a CSV to start evaluating deals." action="Add your first listing" />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title="No deals in this lane"
          body={filter.includeHardRejected ? "Try widening the ratio, title, repair, or score filters." : "Try widening the filters, or show hard rejects to inspect listings blocked by title, fraud, or major-risk rules."}
          action={filter.includeHardRejected ? "Reset filters" : "Show hard rejects"}
          onAction={() => filter.includeHardRejected ? resetFilters() : updateFilter({ includeHardRejected: true })}
        />
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => <DealCard key={item.id} item={item} />)}
        </div>
      )}

      <p className="mx-auto max-w-2xl text-center text-xs leading-5 text-[#7b8178]">Reference value and repair estimates are planning-grade. A seller claim is not a clean-title verification; confirm VIN, history, title document, and inspection before buying.</p>
    </div>
  );
}

function DealCard({ item }: { item: DealInboxItem }) {
  const style = item.scoreClass ? CLASS_STYLES[item.scoreClass] : null;
  const titleLabel = item.titleState === "HISTORY_CLEAN" || item.titleState === "VERIFIED" ? "History-clean" : item.titleState === "DOCUMENT_REVIEWED" ? "Document reviewed" : item.titleState === "SELLER_CLAIMS_CLEAN" ? "Seller claims clean" : "Title unknown";
  const repairLabel = item.repairCount === 1 ? "1 repair signal" : `${item.repairCount} repair signals`;
  const referenceLabel = item.valuationProvider === "manual-kbb-entry" || item.valuationProvider === "kbb-licensed"
    ? "KBB Good"
    : item.valuationProvider === "marketcheck-price" ? "MarketCheck proxy" : "Good reference";
  const basisWarning = item.valuationBasis && item.valuationBasis !== "KBB_GOOD";

  return (
    <article className="group rounded-[1.5rem] border border-[#ded9cf] bg-[#fffdf8] p-5 shadow-[0_10px_30px_rgba(45,40,30,0.04)] transition hover:-translate-y-0.5 hover:border-[#aabfa2] hover:shadow-[0_16px_40px_rgba(45,40,30,0.08)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold tracking-[-0.025em] text-[#1d2924]">{item.headline}</h3>
            {item.hardRejected && <span className="rounded-full bg-[#f8d9d1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a3b2c]">Hard reject</span>}
          </div>
          <p className="mt-1 text-sm text-[#727a70]">{item.trim ? `${item.trim} · ` : ""}{item.mileage ? `${item.mileage.toLocaleString()} miles` : "Mileage unknown"}{item.location ? ` · ${item.location}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {style && <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${style.badge}`}>{item.score}/100 · {style.label.replace(/^[^ ]+ /, "")}</span>}
          <span className="rounded-full border border-[#d9d4ca] px-3 py-1.5 text-xs font-medium text-[#687168]">{item.stage.replaceAll("_", " ")}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Metric label="Asking" value={money(item.price)} detail="Marketplace" />
        <Metric label={referenceLabel} value={money(item.referenceValue)} detail="planning value" />
        <Metric label="Ask / reference" value={pct(item.askingRatio)} detail={item.discountPct === null ? "discount unknown" : `${Math.round(item.discountPct)}% below · ${referenceLabel}`} accent />
        <Metric label="Expected repairs" value={money(item.repairExpected)} detail={repairLabel} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#ece8df] pt-4">
        <span className="rounded-full bg-[#e5f1dc] px-3 py-1.5 text-xs font-semibold text-[#35604d]">{titleLabel}</span>
        {item.hasRepairEvidence && <span className="rounded-full bg-[#f5ead1] px-3 py-1.5 text-xs font-semibold text-[#7b5b20]">Needs work</span>}
        {basisWarning && <span className="rounded-full bg-[#f8d9d1] px-3 py-1.5 text-xs font-semibold text-[#8a3b2c]">Not KBB-qualified</span>}
        {item.expectedMargin !== null && <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${item.expectedMargin >= 0 ? "bg-[#e6f0e7] text-[#35604d]" : "bg-[#f8d9d1] text-[#8a3b2c]"}`}>{money(item.expectedMargin)} expected room</span>}
        <Link href={`/listings/${item.id}`} className="ml-auto rounded-full bg-[#19392f] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2c5747]">Open deal →</Link>
      </div>
    </article>
  );
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <div className={`rounded-xl px-3.5 py-3 ${accent ? "bg-[#e5f1dc]" : "bg-[#f4f1e9]"}`}><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#7b8178]">{label}</p><p className={`mt-1 text-lg font-semibold tracking-[-0.02em] ${accent ? "text-[#28533f]" : "text-[#26352d]"}`}>{value}</p><p className="mt-0.5 text-xs text-[#7b8178]">{detail}</p></div>;
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "green" | "lime" | "cream" }) {
  const toneClass = tone === "green" ? "bg-[#19392f] text-[#f5f1e8]" : tone === "lime" ? "bg-[#c6e49d] text-[#19392f]" : "border border-[#ded9cf] bg-[#fffdf8] text-[#26352d]";
  return <div className={`rounded-[1.25rem] p-4 ${toneClass}`}><p className={`eyebrow ${tone === "cream" ? "text-[#7b8178]" : "opacity-70"}`}>{label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{value}</p><p className={`mt-1 text-xs ${tone === "cream" ? "text-[#7b8178]" : "opacity-70"}`}>{detail}</p></div>;
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction?: () => void }) {
  return <div className="rounded-[1.5rem] border border-dashed border-[#c9c5bb] bg-[#fffdf8] px-6 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5f1dc] text-xl text-[#35604d]">⌕</div><h2 className="mt-4 text-xl font-semibold tracking-[-0.025em]">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#727a70]">{body}</p>{onAction ? <button type="button" onClick={onAction} className="mt-5 rounded-full bg-[#19392f] px-5 py-2.5 text-sm font-semibold text-white">{action}</button> : <Link href="/ingest" className="mt-5 inline-flex rounded-full bg-[#19392f] px-5 py-2.5 text-sm font-semibold text-white">{action}</Link>}</div>;
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
}
