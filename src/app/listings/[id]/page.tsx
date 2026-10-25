import Link from "next/link";
import { notFound } from "next/navigation";
import DetailActions from "./actions";
import WorkflowRecords from "./workflow-records";
import { getListing, latestEvaluation, latestHistoryCheck, listInspections, listOffers, listSellerInteractions, listUserIssues, listValuations } from "@/lib/repo";
import { money, pct } from "@/lib/format";
import { withServerAuth } from "@/lib/server-auth";
import { missingInformation } from "@/domain/missing-information";

export const dynamic = "force-dynamic";

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  return withServerAuth(async () => {
    const { id } = await params;
    const listing = await getListing(id);
    if (!listing) notFound();
    const [evaluation, history, valuations, issues, inspections, offers, interactions] = await Promise.all([
      latestEvaluation(id), latestHistoryCheck(id), listValuations(id), listUserIssues(id), listInspections(id), listOffers(id), listSellerInteractions(id),
    ]);
    const missing = missingInformation(listing, history, valuations[0] ?? null, issues);
    const headline = [listing.vehicle.year, listing.vehicle.make, listing.vehicle.model, listing.vehicle.trim].filter(Boolean).join(" ") || listing.title || "Untitled listing";

    return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div><Link href="/" className="text-sm text-zinc-500 hover:underline">← Inbox</Link><h1 className="mt-1 text-2xl font-bold">{headline}</h1></div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase">{listing.workflowStage}</span>
      </div>
      <DetailActions listingId={id} stage={listing.workflowStage} watched={false} vin={listing.vin} hardRejected={evaluation?.hardRejected} />

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Listing evidence</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-zinc-500">Asking</dt><dd>{money(listing.price)}</dd></div>
            <div><dt className="text-zinc-500">Mileage</dt><dd>{listing.mileage?.toLocaleString() ?? "—"}</dd></div>
            <div><dt className="text-zinc-500">VIN</dt><dd className="font-mono">{listing.vin ?? "Not provided"}</dd></div>
            <div><dt className="text-zinc-500">VIN confidence</dt><dd>{listing.vinConfidence}</dd></div>
            <div><dt className="text-zinc-500">Seller title claim</dt><dd>{listing.titleClaims[0]?.claim ?? "None captured"}</dd></div>
            <div><dt className="text-zinc-500">Source</dt><dd>{listing.sourceId}</dd></div>
          </dl>
        </article>
        <article className={`rounded-lg border p-5 shadow-sm ${evaluation?.hardRejected ? "border-red-200 bg-red-50" : "bg-white"}`}>
          <h2 className="font-semibold">Decision</h2>
          {evaluation ? <>
            <p className="mt-2 text-2xl font-bold">{evaluation.score.total}/100 · {evaluation.score.scoreClass}</p>
            <p className="mt-2 text-sm">Title state: <strong>{evaluation.titleState}</strong></p>
            <p className="text-sm">Ask/reference: <strong>{pct(evaluation.economics?.askingRatio ?? null)}</strong></p>
            <p className="text-sm">Expected margin: <strong>{money(evaluation.economics?.expectedMargin ?? null)}</strong></p>
            {evaluation.repairs.unknownCosts && <p className="mt-3 text-sm font-semibold text-amber-700">Repair costs are unknown; qualification is suppressed until findings are confirmed.</p>}
            {evaluation.score.rejectionReasons.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-red-700">{evaluation.score.rejectionReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
          </> : <p className="mt-2 text-sm text-zinc-500">Not evaluated yet.</p>}
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3"><h2 className="font-semibold">Deal confidence</h2><strong>{missing.confidence}%</strong></div>
          <p className="mt-1 text-sm text-zinc-700">Confidence in the evidence is separate from the deal score.</p>
          {missing.items.length ? <ul className="mt-3 space-y-2 text-sm">{missing.items.map((item) => <li key={item.code}><strong>⚠ {item.label}:</strong> {item.nextAction}</li>)}</ul> : <p className="mt-3 text-sm text-emerald-700">Required evidence is present enough for the next workflow step.</p>}
          <p className="mt-3 text-xs font-semibold text-zinc-600">Next action: {missing.nextAction}</p>
        </article>
        <article className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">Score explanation</h2>{evaluation ? <div className="mt-3 space-y-2 text-sm">{evaluation.score.factors.map((factor) => <div key={factor.key} className="flex items-start justify-between gap-3"><span><strong>{factor.label}</strong><span className="ml-2 text-xs text-zinc-500">{factor.evidence}</span></span><strong>{factor.value}</strong></div>)}</div> : <p className="mt-2 text-sm text-zinc-500">Evaluate this listing to see the score factors.</p>}</article>
      </section>

      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Title and history provenance</h2>
        {history ? <dl className="mt-3 grid gap-2 text-sm md:grid-cols-3"><div><dt className="text-zinc-500">Provider</dt><dd>{history.provider}</dd></div><div><dt className="text-zinc-500">Checked</dt><dd>{new Date(history.checkedAt).toLocaleString()}</dd></div><div><dt className="text-zinc-500">Brands</dt><dd>{history.brands.length ? history.brands.join(", ") : "None returned"}</dd></div></dl> : <p className="mt-2 text-sm text-amber-700">No provider-backed history check is stored. Seller claims and manual document review are not independent history verification.</p>}
        <DetailActions slot="title" listingId={id} />
        <DetailActions slot="history" listingId={id} hasVin={Boolean(listing.vin)} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">Valuation</h2><DetailActions slot="valuation" listingId={id} /><ul className="mt-3 space-y-2 text-sm">{valuations.map((v) => <li key={`${v.provider}-${v.computedAt}`}><div>{v.provider}: {money(v.referenceGoodValue)} <span className="text-zinc-500">({new Date(v.computedAt).toLocaleDateString()})</span></div><div className="text-xs text-zinc-500">{v.notes || "No provenance note recorded."}{v.compMedian !== null ? ` Comparable median: ${money(v.compMedian)}.` : ""}</div></li>)}</ul></article>
        <article className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">Repair findings</h2><DetailActions slot="issues" listingId={id} /><ul className="mt-3 space-y-1 text-sm">{issues.map((issue) => <li key={issue.id}>{issue.category}: {money(issue.estimateExpected)} · {issue.description}</li>)}</ul></article>
      </section>
      <section className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">Outcome tracking</h2><DetailActions slot="outcome" listingId={id} /></section>
      <section className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">Inspection checklist</h2><DetailActions slot="inspection" listingId={id} /></section>
      <section className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">Offer calculator</h2><p className="mt-1 text-sm text-zinc-500">Uses the current valuation, repairs, and transaction-cost assumptions.</p><DetailActions slot="offer" listingId={id} /></section>
      <section className="rounded-lg border bg-white p-5 shadow-sm"><h2 className="font-semibold">Report a problem</h2><DetailActions slot="feedback" listingId={id} /></section>
      <WorkflowRecords
        listingId={id}
        inspections={inspections.map((item) => ({ id: item.id, status: item.status, scheduledAt: item.scheduledAt?.toISOString() ?? null, findings: item.findings, notes: item.notes, createdAt: item.createdAt.toISOString() }))}
        offers={offers.map((item) => ({ id: item.id, amount: Number(item.amount), status: item.status, notes: item.notes, madeAt: item.madeAt.toISOString(), respondedAt: item.respondedAt?.toISOString() ?? null }))}
        interactions={interactions.map((item) => ({ id: item.id, type: item.type, body: item.body, occurredAt: item.occurredAt.toISOString() }))}
      />
    </main>
    );
  });
}
