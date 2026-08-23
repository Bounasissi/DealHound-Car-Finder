import { latestEvaluation, listListings } from "@/lib/repo";
import { getActiveProfile } from "@/lib/evaluate";
import { withServerAuth } from "@/lib/server-auth";
import DealInboxClient from "./deal-inbox-client";
import type { DealInboxItem } from "@/lib/deal-filters";

export const dynamic = "force-dynamic";

export default async function DealInbox() {
  return withServerAuth(async () => {
    const listings = await listListings({ profile: (await getActiveProfile()) ?? undefined, sort: "recent" });
    const items: DealInboxItem[] = await Promise.all(
      listings.map(async (l) => {
      const ev = await latestEvaluation(l.id!);
      const headline = [l.vehicle.year, l.vehicle.make, l.vehicle.model].filter(Boolean).join(" ") || l.title || "Untitled listing";
      return {
        id: l.id!,
        headline,
        year: l.vehicle.year,
        make: l.vehicle.make,
        model: l.vehicle.model,
        trim: l.vehicle.trim,
        price: l.price,
        score: ev?.score.total ?? null,
        scoreClass: ev?.score.scoreClass ?? null,
        askingRatio: ev?.economics?.askingRatio ?? null,
        referenceValue: ev?.valuation.referenceGoodValue ?? null,
        discountPct: ev?.valuation.discountPct ?? null,
        expectedMargin: ev?.economics?.expectedMargin ?? null,
        titleState: l.titleState,
        stage: l.workflowStage ?? "FOUND",
        hardRejected: ev?.hardRejected ?? false,
        repairExpected: ev?.repairs.totalExpected ?? null,
        repairCount: ev?.repairs.issues.length ?? 0,
        hasRepairEvidence: Boolean(ev && ev.repairs.issues.length > 0),
        mileage: l.mileage,
        location: l.location,
        url: l.url,
        lastSeenAt: l.lastSeenAt,
      };
      }),
    );

    return <DealInboxClient initialItems={items} />;
  });
}
