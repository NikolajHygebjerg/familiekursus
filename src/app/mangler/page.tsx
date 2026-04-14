"use client";

import { useEffect, useState } from "react";

interface MissingItem {
  navn: string;
}

export default function ManglerPage() {
  const [data, setData] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/mangler")
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Mangler</h1>
          <p className="mt-1 text-slate-600">
            Navne fra Betalt der ikke har valgt workshops i 2026 (sammenlignes med kolonnen Navn).
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-medium">Fejl</p>
            <p className="mt-1 text-sm">{error}</p>
            <p className="mt-2 text-sm">
              Tjek at Betalt- og 2026-tabellerne findes i Airtable og at AIRTABLE_API_KEY er sat.
            </p>
          </div>
        )}

        {loading && !error && (
          <div className="flex items-center gap-2 text-slate-500">
            <svg
              className="h-5 w-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Henter data...
          </div>
        )}

        {!loading && !error && (
          <section className="rounded-xl bg-white p-6 shadow-lg">
            {data.length === 0 ? (
              <p className="text-slate-600">
                Alle i Betalt har valgt workshops. Ingen mangler.
              </p>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2">
                  <span className="font-medium text-slate-700">Antal der mangler</span>
                  <span className="text-2xl font-bold text-amber-600">{data.length}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {data.map((item) => (
                    <li
                      key={item.navn}
                      className="py-3 first:pt-0"
                    >
                      <span className="text-slate-800">{item.navn}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
