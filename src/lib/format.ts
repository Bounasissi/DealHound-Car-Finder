import type { ScoreClass } from "@/domain/types";

export const CLASS_STYLES: Record<ScoreClass, { label: string; badge: string; dot: string }> = {
  EXCEPTIONAL: { label: "🔥 Exceptional", badge: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  STRONG_BUY: { label: "✅ Strong Buy", badge: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  INVESTIGATE: { label: "⚠️ Investigate", badge: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  HIGH_RISK: { label: "🟠 High Risk", badge: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  REJECT: { label: "❌ Reject", badge: "bg-zinc-200 text-zinc-700 border-zinc-300", dot: "bg-zinc-400" },
};

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}
