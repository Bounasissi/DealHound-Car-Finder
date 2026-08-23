"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SyncSourceButton({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/sources/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const body = (await response.json()) as { count?: number; source?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? `Sync failed (HTTP ${response.status})`);
      setMessage(`Synced ${body.count ?? 0} from ${body.source ?? "feed"}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={sync} disabled={busy} className="rounded-full bg-[#19392f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2c5747] disabled:cursor-wait disabled:opacity-50">
        {busy ? "Syncing…" : "Sync feed"}
      </button>
      {message && <span className="max-w-52 text-right text-[11px] text-[#687168]">{message}</span>}
    </div>
  );
}
