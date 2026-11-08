"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

type StatusPayload = {
  ok?: boolean;
  supabaseConfigured?: boolean;
  supabaseProjectRef?: string | null;
  kursusYear?: number;
  participants2027RowCount?: number | null;
  rosterMemberCount?: number;
  login?: string;
  dataSource?: {
    host: string | null;
    projectRef: string | null;
    kursusYear: number;
    participantsTableKey: string;
    tableKeyCounts: Record<string, number>;
    fkRecordsTotal: number;
    checkedAt: string;
    vercelEnv: string | null;
    deployRef: string | null;
  };
};

export default function SupabaseSourceInfo() {
  const { email, isAuthReady } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const login = email?.trim();
      const qs = login ? `?login=${encodeURIComponent(login)}` : "";
      const res = await fetch(`/api/status${qs}`, { cache: "no-store" });
      const data = (await res.json()) as StatusPayload;
      if (!res.ok) throw new Error("Kunne ikke hente status");
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (open && !status && !loading) void load();
  }, [open, isAuthReady, status, loading, load]);

  const ds = status?.dataSource;
  const counts = ds?.tableKeyCounts ?? {};
  const countLines = Object.keys(counts)
    .sort()
    .map((k) => `${k}: ${counts[k]}`);

  return (
    <div className="border-t border-slate-200 bg-slate-100/80 px-4 py-2 text-xs text-slate-600">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left font-medium text-slate-700"
      >
        {open ? "▼" : "▶"} Hvor læser appen data? (Supabase / Vercel)
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading && <p>Henter…</p>}
          {error && <p className="text-red-700">{error}</p>}
          {ds && (
            <>
              <p>
                <span className="text-slate-500">Supabase-vært:</span>{" "}
                <code className="break-all">{ds.host ?? "—"}</code>
              </p>
              <p>
                <span className="text-slate-500">Projekt-ID:</span>{" "}
                <code>{ds.projectRef ?? "—"}</code>
              </p>
              <p>
                <span className="text-slate-500">Kursusår / tabel:</span>{" "}
                {ds.kursusYear} → <code>{ds.participantsTableKey}</code>
              </p>
              <p>
                <span className="text-slate-500">Rækker i fk_records (i alt):</span> {ds.fkRecordsTotal}
              </p>
              <p className="text-slate-500">Fordelt på table_key:</p>
              <ul className="list-inside list-disc pl-1">
                {countLines.length === 0 ? <li>(ingen rækker)</li> : countLines.map((line) => <li key={line}>{line}</li>)}
              </ul>
              {typeof status?.rosterMemberCount === "number" && status.login && (
                <p>
                  <span className="text-slate-500">Familie {status.login} (app):</span>{" "}
                  {status.rosterMemberCount} medlemmer · tabel tæller{" "}
                  {status.participants2027RowCount ?? "?"}{" "}
                  {ds.participantsTableKey.replace("participants_", "")}-deltagere i alt
                </p>
              )}
              <p>
                <span className="text-slate-500">Miljø:</span> {ds.vercelEnv ?? "ukendt"}
                {ds.deployRef ? ` · deploy ${ds.deployRef}` : ""}
              </p>
              <p className="text-slate-500">Tjekket: {new Date(ds.checkedAt).toLocaleString("da-DK")}</p>
              <p className="text-slate-500">
                Sammenlign med Supabase SQL: <code>select table_key, count(*) from fk_records group by table_key</code> —
                tallene skal matche.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700"
          >
            Opdater
          </button>
        </div>
      )}
    </div>
  );
}
