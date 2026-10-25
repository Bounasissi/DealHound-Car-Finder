import { withServerAuth } from "@/lib/server-auth";
import { currentAuthContext } from "@/lib/auth";
import AccountActions from "./account-actions";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return withServerAuth(async () => {
    const context = currentAuthContext();
    return (
      <main className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Account</h1>
          <p className="mt-1 text-sm text-zinc-600">Manage the session used to protect your listings, profiles, and provider credentials.</p>
        </div>
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-zinc-500">Email</dt><dd>{context.email ?? "Legacy token session"}</dd></div>
            <div><dt className="text-zinc-500">Role</dt><dd>{context.role ?? "OWNER"}</dd></div>
            <div><dt className="text-zinc-500">Owner id</dt><dd className="break-all font-mono text-xs">{context.userId}</dd></div>
          </dl>
        </section>
        <AccountActions owner={context.role === "OWNER" || !context.role} />
      </main>
    );
  });
}
