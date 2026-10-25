"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { safeNextPath } from "@/lib/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email.trim() && password ? { email, password } : { token }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNextPath(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-bold">Sign in to DealHound</h1>
        <p className="mt-1 text-sm text-zinc-600">Use your email and password, or a deployment access token when one is provided.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="h-px flex-1 bg-zinc-200" />
          <span>or legacy access token</span>
          <span className="h-px flex-1 bg-zinc-200" />
        </div>
        <label className="block text-sm font-medium">
          Access token
          <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm"
          />
        </label>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-40">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-zinc-600">
          Need an account? <a href="/signup" className="font-semibold text-zinc-900 underline">Create one</a>
        </p>
        <p className="text-center text-sm text-zinc-600"><a href="/reset" className="font-semibold text-zinc-900 underline">Forgot password?</a></p>
      </form>
    </div>
  );
}
