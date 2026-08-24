"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(inviteToken.trim() ? { inviteToken: inviteToken.trim() } : {}) }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-bold">Create your DealHound account</h1>
        <p className="mt-1 text-sm text-zinc-600">The first account becomes the owner. Additional accounts require an owner invitation.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">
          Email
          <input required value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          <span className="mt-1 block text-xs font-normal text-zinc-500">Use at least 12 characters.</span>
        </label>
        <label className="block text-sm font-medium">
          Invitation token <span className="font-normal text-zinc-500">(only for invited users)</span>
          <input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} autoComplete="off" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm" />
        </label>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40">
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-zinc-600">
          Already registered? <a href="/login" className="font-semibold text-zinc-900 underline">Sign in</a>
        </p>
      </form>
    </div>
  );
}
