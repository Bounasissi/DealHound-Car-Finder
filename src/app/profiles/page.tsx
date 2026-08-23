import { listProfiles } from "@/lib/repo";
import ProfileForm from "./profile-form";
import ProfileEdit from "./profile-edit";
import SyncSourceButton from "./sync-source-button";
import { withServerAuth } from "@/lib/server-auth";
import { sourceRegistry } from "@/sources";
import { configuredLicensedKbbProvider } from "@/domain/valuation";
import { historyProvider } from "@/sources/history";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  return withServerAuth(async () => {
    const profiles = await listProfiles();
    const marketCheckReady = Boolean(sourceRegistry.get("marketcheck-fsbo")?.isConfigured());
    const valuationReady = configuredLicensedKbbProvider().isConfigured();
    const historyReady = historyProvider.isConfigured();
    return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Search Profiles</h1>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Discovery readiness</div>
            <p className="mt-1 text-xs text-zinc-500">Sync uses authorized feeds only. No provider key means paste or CSV mode remains available.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <StatusPill label="Marketplace feed" ready={marketCheckReady} />
            <StatusPill label="KBB-equivalent value" ready={valuationReady} />
            <StatusPill label="Title history" ready={historyReady} />
          </div>
        </div>
        {!marketCheckReady && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">To enable automated discovery, configure <code>MARKETCHECK_API_KEY</code> and restart the server. The default source target is <code>facebook.com</code>.</p>}
      </div>
      <ProfileForm />
      <ul className="space-y-3">
        {profiles.map((p) => (
          <li key={p.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{p.name}</div>
              <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{p.active ? "active" : "inactive"}</span><SyncSourceButton profileId={p.id!} /><ProfileEdit id={p.id!} name={p.name} ratio={p.maxAskingRatio} active={p.active} /></div>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div><dt className="text-zinc-500">Location</dt><dd>{p.zip} +{p.radiusMiles}mi</dd></div>
              <div><dt className="text-zinc-500">Vehicle</dt><dd>{[p.yearMin && `${p.yearMin}+`, p.make, p.model].filter(Boolean).join(" ") || "any"}</dd></div>
              <div><dt className="text-zinc-500">Max ask/ref</dt><dd>{(p.maxAskingRatio * 100).toFixed(0)}%</dd></div>
              <div><dt className="text-zinc-500">Clean title</dt><dd>{p.requireCleanTitle ? "required" : "no"}</dd></div>
              <div><dt className="text-zinc-500">Needs work</dt><dd>{p.requireRepairEvidence ? "required" : "no"}</dd></div>
              <div><dt className="text-zinc-500">Max price</dt><dd>{p.priceMax ? `$${p.priceMax.toLocaleString()}` : "any"}</dd></div>
              <div><dt className="text-zinc-500">Max mileage</dt><dd>{p.mileageMax ? p.mileageMax.toLocaleString() : "any"}</dd></div>
              <div><dt className="text-zinc-500">Min margin</dt><dd>${p.minDealMargin.toLocaleString()}</dd></div>
              <div><dt className="text-zinc-500">Max fraud score</dt><dd>{p.maxFraudRiskScore}</dd></div>
            </dl>
            {p.rejectedRepairCategories.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500">
                Rejects repairs: {p.rejectedRepairCategories.join(", ")}
              </p>
            )}
          </li>
        ))}
        {profiles.length === 0 && (
          <li className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
            No profiles yet — create one below.
          </li>
        )}
      </ul>
    </div>
    );
  });
}

function StatusPill({ label, ready }: { label: string; ready: boolean }) {
  return <span className={`rounded-full px-2.5 py-1 font-medium ${ready ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>{ready ? "✓" : "—"} {label}</span>;
}
