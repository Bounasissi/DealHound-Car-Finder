import { latestEvaluation, listListings } from "@/lib/repo";
import { getActiveProfile } from "@/lib/evaluate";
import { withServerAuth } from "@/lib/server-auth";
import DealInboxClient from "./deal-inbox-client";
import type { DealInboxItem } from "@/lib/deal-filters";

export const dynamic = "force-dynamic";

export default async function DealInbox() {
  return withServerAuth(async () => {
    // The inbox filters are applied after evaluation in the client. Load the
    // complete owner-scoped set so a qualified listing cannot be hidden after
    // the first pagination window.
    const activeProfile = await getActiveProfile();
    const listings = await listListings({ profile: activeProfile ?? undefined, sort: "recent", pageSize: "all" });
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
        valuationProvider: ev?.valuation.chosenProvider ?? null,
        valuationBasis: ev?.valuation.chosenBasis ?? null,
        discountPct: ev?.valuation.discountPct ?? null,
        expectedMargin: ev?.economics?.expectedMargin ?? null,
        // The evaluation carries the authoritative history-provider state;
        // the listing row may still contain the original seller-claim state.
        titleState: ev?.titleState ?? l.titleState,
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

    return (
      <DealInboxClient
        initialItems={items}
        profileDefaults={activeProfile ? {
          maxAskingRatio: activeProfile.maxAskingRatio,
          title: activeProfile.requireCleanTitle ? "history-clean" : "any",
          needsWork: activeProfile.requireRepairEvidence,
          maxExpectedRepairs: activeProfile.maxExpectedRepairs,
        } : undefined}
      />
    );
  });
}
