import Link from "next/link";
import { listAlerts } from "@/lib/repo";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = await listAlerts();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>
      <p className="text-sm text-zinc-600">
        Only qualifying deals alert: score ≥ 85, asking ratio ≤ 70%, sufficient title confidence,
        expected margin ≥ profile minimum, and no major mechanical risk.
      </p>
      {alerts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
          No alerts yet. Qualifying deals appear here automatically after evaluation.
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => {
            const p = a.payload as Record<string, unknown>;
            return (
              <li key={a.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between">
                  <Link href={`/listings/${a.listingId}`} className="font-semibold hover:underline">
                    {String(p.headline)}
                  </Link>
                  <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
                    {String(p.score)}/100 · {String(p.scoreClass)}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                  <div><dt className="text-zinc-500">Price</dt><dd>{money(Number(p.price))}</dd></div>
                  <div><dt className="text-zinc-500">Reference</dt><dd>{money(Number(p.referenceValue))}</dd></div>
                  <div><dt className="text-zinc-500">Discount</dt><dd>{p.discountPct ? `${Number(p.discountPct).toFixed(1)}%` : "—"}</dd></div>
                  <div><dt className="text-zinc-500">Repairs</dt><dd>{money(Number(p.expectedRepairs))}</dd></div>
                  <div><dt className="text-zinc-500">All-in</dt><dd>{money(Number(p.allInBasis))}</dd></div>
                  <div><dt className="text-zinc-500">Margin</dt><dd>{money(Number(p.expectedMargin))}</dd></div>
                  <div><dt className="text-zinc-500">Title</dt><dd>{String(p.titleConfidence)}</dd></div>
                  <div><dt className="text-zinc-500">Distance</dt><dd>{p.distanceMiles ? `${p.distanceMiles} mi` : "—"}</dd></div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
