"use client";

import { useEffect, useState } from "react";

interface WorkshopCount {
  name: string;
  count: number;
  participants?: string[];
}

const WORKSHOP_LABELS: Record<string, string> = {
  workshop1: "Workshop 1",
  workshop2: "Workshop 2",
  workshop3: "Workshop 3",
  workshop4: "Workshop 4",
  voksen: "Workshop Forældre (Voksen)",
};

export default function AntalPage() {
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>("workshop1");
  const [data, setData] = useState<WorkshopCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWorkshop, setExpandedWorkshop] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setExpandedWorkshop(null);
    fetch(`/api/workshops?workshop=${selectedWorkshop}&withParticipants=true`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedWorkshop]);

  const totalParticipants = data.reduce((sum, w) => sum + w.count, 0);

  const toggleExpand = (name: string) => {
    setExpandedWorkshop((prev) => (prev === name ? null : name));
  };

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Workshopoversigt</h1>
          <p className="mt-1 text-slate-600">
            Klik på et workshop-navn for at se deltagerlisten.
          </p>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2">
          {(["workshop1", "workshop2", "workshop3", "workshop4", "voksen"] as const).map(
            (key) => (
              <button
                key={key}
                onClick={() => setSelectedWorkshop(key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  selectedWorkshop === key
                    ? "bg-amber-500 text-white shadow-md"
                    : "bg-white text-slate-600 shadow-sm hover:bg-slate-100"
                }`}
              >
                {WORKSHOP_LABELS[key]}
              </button>
            )
          )}
        </nav>

        <section className="rounded-xl bg-white p-6 shadow-lg">
          <h2 className="mb-6 text-xl font-semibold text-slate-800">
            {WORKSHOP_LABELS[selectedWorkshop]}
          </h2>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-700">
              <p className="font-medium">Fejl ved hentning af data</p>
              <p className="mt-1 text-sm">{error}</p>
              <p className="mt-2 text-sm">
                Tjek at AIRTABLE_API_KEY er sat i miljøvariabler.
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

          {!loading && !error && data.length === 0 && (
            <p className="text-slate-500">Ingen tilmeldinger fundet for denne workshop.</p>
          )}

          {!loading && !error && data.length > 0 && (
            <>
              <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2">
                <span className="font-medium text-slate-700">I alt tilmeldte</span>
                <span className="text-2xl font-bold text-amber-600">{totalParticipants}</span>
              </div>

              <ul className="divide-y divide-slate-100">
                {data.map((workshop) => {
                  const isExpanded = expandedWorkshop === workshop.name;
                  return (
                    <li key={workshop.name} className="py-3 first:pt-0">
                      <button
                        onClick={() => toggleExpand(workshop.name)}
                        className="flex w-full items-center justify-between text-left transition-colors hover:bg-slate-50 rounded-lg px-2 py-2 -mx-2"
                      >
                        <span className="font-medium text-slate-800">{workshop.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                            {workshop.count}
                          </span>
                          <svg
                            className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </button>
                      {isExpanded && workshop.participants && workshop.participants.length > 0 && (
                        <ul className="mt-2 ml-2 space-y-1 border-l-2 border-amber-200 pl-4">
                          {workshop.participants.map((p) => (
                            <li key={p} className="text-sm text-slate-600">
                              {p}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
