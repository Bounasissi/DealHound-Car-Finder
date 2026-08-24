import { TITLE_STATE_RANK, type ScoreClass, type TitleState } from "@/domain/types";
import { isAuthoritativeCleanTitle } from "@/domain/title";

export type DealTitleFilter = "any" | "seller-claim" | "history-clean";
export type DealSort = "best" | "recent" | "price" | "score";

export interface DealFilter {
  query: string;
  maxAskingRatio: number | null;
  title: DealTitleFilter;
  needsWork: boolean;
  includeHardRejected: boolean;
  maxExpectedRepairs: number | null;
  minScore: number | null;
  sort: DealSort;
}

export interface DealInboxItem {
  id: string;
  headline: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  price: number | null;
  mileage: number | null;
  location: string | null;
  url?: string;
  score: number | null;
  scoreClass: ScoreClass | null;
  askingRatio: number | null;
  referenceValue: number | null;
  valuationProvider?: string | null;
  valuationBasis?: "KBB_GOOD" | "COMPARABLES" | "MARKET_PROXY" | "UNKNOWN" | null;
  discountPct: number | null;
  expectedMargin: number | null;
  titleState: TitleState | null;
  stage: string;
  hardRejected: boolean;
  repairExpected: number | null;
  repairCount: number;
  hasRepairEvidence: boolean;
  lastSeenAt?: string;
}

export function filterDeals(items: DealInboxItem[], filter: DealFilter): DealInboxItem[] {
  const query = filter.query.trim().toLowerCase();

  return items
    .filter((item) => {
      if (query && ![item.headline, item.make, item.model, item.location].some((value) => value?.toLowerCase().includes(query))) {
        return false;
      }
      if (filter.maxAskingRatio !== null && (item.askingRatio === null || item.askingRatio > filter.maxAskingRatio)) return false;
      if (filter.title === "history-clean" && (!item.titleState || !isAuthoritativeCleanTitle(item.titleState))) return false;
      if (filter.title === "seller-claim" && titleRank(item.titleState) < TITLE_STATE_RANK.SELLER_CLAIMS_CLEAN) return false;
      if (filter.needsWork && !item.hasRepairEvidence) return false;
      if (!filter.includeHardRejected && item.hardRejected) return false;
      if (filter.maxExpectedRepairs !== null && (item.repairExpected === null || item.repairExpected > filter.maxExpectedRepairs)) return false;
      if (filter.minScore !== null && (item.score === null || item.score < filter.minScore)) return false;
      return true;
    })
    .sort((a, b) => {
      if (filter.sort === "price") return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (filter.sort === "score") return (b.score ?? -1) - (a.score ?? -1);
      if (filter.sort === "recent") return (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "");
      return (a.askingRatio ?? Infinity) - (b.askingRatio ?? Infinity) || (b.score ?? -1) - (a.score ?? -1);
    });
}

function titleRank(titleState: TitleState | null): number {
  return titleState ? TITLE_STATE_RANK[titleState] : TITLE_STATE_RANK.UNKNOWN;
}
