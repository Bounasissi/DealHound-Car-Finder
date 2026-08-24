"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AccountActions({ owner }: { owner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
  }

  async function deleteAccount() {
    if (!window.confirm("Delete this account and its DealHound data? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE", credentials: "same-origin" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      router.replace("/signup");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {owner && <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="font-semibold text-emerald-900">Invite your friend</h2>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void (async () => { const response = await fetch("/api/auth/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: inviteEmail }) }); const data = await response.json(); if (!response.ok) { setError(data.error ?? `HTTP ${response.status}`); return; } setInviteToken(data.token ?? null); })(); }}>
          <input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="friend@example.com" className="min-w-64 rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          <button disabled={busy} className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">Create invite</button>
        </form>
        {inviteToken && <p className="mt-3 break-all text-xs text-emerald-900">Share this invite token with your friend: <code>{inviteToken}</code></p>}
        {!inviteToken && <p className="mt-2 text-xs text-emerald-800">In production, configure email delivery so invite tokens are sent without exposing them in the response.</p>}
      </section>}
      <section className="rounded-lg border border-red-200 bg-red-50 p-5">
      <h2 className="font-semibold text-red-900">Session and account</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => void logout()} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-40">Sign out</button>
        <button disabled={busy} onClick={() => void deleteAccount()} className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-40">Delete account and data</button>
      </div>
      {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
      </section>
    </div>
  );
}
