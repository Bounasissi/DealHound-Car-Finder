import Link from "next/link";
import { latestEvaluation, listListings } from "@/lib/repo";
import { CLASS_STYLES, money, pct } from "@/lib/format";
import type { DealEvaluation } from "@/domain/types";

export const dynamic = "force-dynamic";

interface InboxItem {
  id: string;
  headline: string;
  price: number | null;
  score: number | null;
  scoreClass: string | null;
  askingRatio: number | null;
  expectedMargin: number | null;
  titleState: string | null;
  stage: string;
  watched: boolean;
  hardRejected: boolean;
  evaluation: DealEvaluation | null;
}

export default async function DealInbox() {
  const listings = await listListings();
  const items: InboxItem[] = await Promise.all(
    listings.map(async (l) => {
      const ev = await latestEvaluation(l.id!);
      const headline = [l.vehicle.year, l.vehicle.make, l.vehicle.model].filter(Boolean).join(" ") || l.title || "Untitled listing";
      return {
        id: l.id!,
        headline,
        price: l.price,
        score: ev?.score.total ?? null,
        scoreClass: ev?.score.scoreClass ?? null,
        askingRatio: ev?.economics?.askingRatio ?? null,
        expectedMargin: ev?.economics?.expectedMargin ?? null,
        titleState: l.titleState,
        stage: l.workflowStage,
        watched: false,
        hardRejected: ev?.hardRejected ?? false,
        evaluation: ev,
      };
    }),
  );

  items.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const counts = items.reduce<Record<string, number>>((acc, i) => {
    if (i.scoreClass) acc[i.scoreClass] = (acc[i.scoreClass] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Deal Inbox</h1>
        <Link
          href="/ingest"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + Ingest Listing
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["EXCEPTIONAL", "STRONG_BUY", "INVESTIGATE", "HIGH_RISK", "REJECT"] as const).map((cls) => (
          <div key={cls} className={`rounded-lg border p-3 ${CLASS_STYLES[cls].badge}`}>
            <div className="text-xs font-medium uppercase tracking-wide opacity-80">{CLASS_STYLES[cls].label}</div>
            <div className="text-2xl font-bold">{counts[cls] ?? 0}</div>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
          No listings yet. Paste a Facebook Marketplace listing to evaluate your first deal.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const style = item.scoreClass ? CLASS_STYLES[item.scoreClass as keyof typeof CLASS_STYLES] : null;
            return (
              <li key={item.id}>
                <Link
                  href={`/listings/${item.id}`}
                  className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400 hover:shadow"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{item.headline}</div>
                    <div className="flex items-center gap-2">
                      {style && (
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>
                          {item.score}/100 · {style.label}
                        </span>
                      )}
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{item.stage}</span>
                      {item.hardRejected && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                          HARD REJECT
                        </span>
                      )}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
                    <div><dt className="text-zinc-500">Asking</dt><dd className="font-medium">{money(item.price)}</dd></div>
                    <div><dt className="text-zinc-500">Ask/Ref</dt><dd className="font-medium">{pct(item.askingRatio)}</dd></div>
                    <div><dt className="text-zinc-500">Exp. Margin</dt><dd className="font-medium">{money(item.expectedMargin)}</dd></div>
                    <div><dt className="text-zinc-500">Title</dt><dd className="font-medium">{item.titleState}</dd></div>
                    <div><dt className="text-zinc-500">Repairs</dt><dd className="font-medium">{item.evaluation ? money(item.evaluation.repairs.totalExpected) : "—"}</dd></div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
