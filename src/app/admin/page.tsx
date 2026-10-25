import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, usageCounters } from "@/db/schema";
import { currentUserRole } from "@/lib/auth";
import { withServerAuth } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return withServerAuth(async () => {
    if (currentUserRole() !== "OWNER") return <main className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">Owner access required.</main>;
    const [failedJobs, usage] = await Promise.all([
      db.select().from(jobs).where(eq(jobs.state, "FAILED")).orderBy(desc(jobs.updatedAt)).limit(50),
      db.select().from(usageCounters).orderBy(desc(usageCounters.updatedAt)).limit(100),
    ]);
    return <main className="space-y-6"><div><p className="eyebrow text-[#35604d]">Operations</p><h1 className="mt-2 text-3xl font-bold">Admin console</h1><p className="mt-1 text-sm text-zinc-600">Failed jobs and usage are visible here without direct database access.</p></div>
      <section className="rounded-lg border bg-white p-5"><h2 className="font-semibold">Failed jobs</h2>{failedJobs.length ? <ul className="mt-3 space-y-2 text-sm">{failedJobs.map((job) => <li key={job.id} className="rounded bg-red-50 p-3"><strong>{job.kind}</strong> · {job.ownerId} · attempts {job.attempts}<div className="text-xs text-red-800">{job.lastError ?? "No error recorded"}</div></li>)}</ul> : <p className="mt-2 text-sm text-zinc-500">No failed jobs.</p>}</section>
      <section className="rounded-lg border bg-white p-5"><h2 className="font-semibold">Recent usage</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Owner</th><th className="p-2">Day</th><th className="p-2">Metric</th><th className="p-2">Count</th></tr></thead><tbody>{usage.map((row) => <tr key={row.id} className="border-b last:border-0"><td className="p-2 font-mono text-xs">{row.ownerId}</td><td className="p-2">{row.day}</td><td className="p-2">{row.metric}</td><td className="p-2">{row.count}</td></tr>)}</tbody></table></div></section>
    </main>;
  });
}
