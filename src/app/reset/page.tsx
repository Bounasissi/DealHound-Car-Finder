"use client";

import { useState } from "react";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestReset(event: React.FormEvent) {
    event.preventDefault(); setError(null); setMessage(null);
    const response = await fetch("/api/auth/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? `HTTP ${response.status}`); return; }
    setToken(data.token ?? ""); setMessage(data.token ? "Use the token below to choose a new password." : "If the account exists, reset instructions have been sent.");
  }

  async function consumeReset(event: React.FormEvent) {
    event.preventDefault(); setError(null); setMessage(null);
    const response = await fetch("/api/auth/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? `HTTP ${response.status}`); return; }
    setMessage("Password reset. You can now sign in."); setPassword("");
  }

  return <main className="mx-auto max-w-md space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
    <div><h1 className="text-2xl font-bold">Reset password</h1><p className="mt-1 text-sm text-zinc-600">Request a reset link or paste a reset token from your email.</p></div>
    <form onSubmit={requestReset} className="space-y-3"><label className="block text-sm font-medium">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label><button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Request reset</button></form>
    <form onSubmit={consumeReset} className="space-y-3 border-t pt-4"><label className="block text-sm font-medium">Reset token<input required value={token} onChange={(event) => setToken(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-xs" /></label><label className="block text-sm font-medium">New password<input required minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label><button className="rounded-md border px-4 py-2 text-sm font-semibold">Set new password</button></form>
    {message && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </main>;
}
