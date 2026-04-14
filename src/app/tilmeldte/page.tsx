"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/context/FamilyContext";
import { useAuth } from "@/context/AuthContext";

interface FamilyMember {
  navn: string;
  workshop1: string | null;
  workshop2: string | null;
  workshop3: string | null;
  workshop4: string | null;
  voksen: string | null;
}

const WORKSHOP_LABELS: Record<string, string> = {
  workshop1: "Workshop 1",
  workshop2: "Workshop 2",
  workshop3: "Workshop 3",
  workshop4: "Workshop 4",
  voksen: "Workshop Forældre",
};

export default function TilmeldtePage() {
  const { selectedFamily, isKursusleder } = useFamily();
  const { email } = useAuth();
  const [families, setFamilies] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [pickedFamily, setPickedFamily] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const displayFamily = isKursusleder ? pickedFamily : selectedFamily;

  useEffect(() => {
    if (isKursusleder) {
      setLoadingFamilies(true);
      fetch("/api/families/emails")
        .then((res) => (res.ok ? res.json() : []))
        .then((data: string[]) => setFamilies(data))
        .catch(() => setFamilies([]))
        .finally(() => setLoadingFamilies(false));
    }
  }, [isKursusleder]);

  const suggestions = useMemo(() => {
    if (!search.trim()) return families.slice(0, 10);
    const lower = search.toLowerCase();
    return families.filter((f) => f.toLowerCase().includes(lower)).slice(0, 10);
  }, [families, search]);

  const loadFamily = useCallback((emailOrName: string) => {
    setPickedFamily(emailOrName);
    setSearch(emailOrName);
    setShowSuggestions(false);
    setLoadingMembers(true);
    setError(null);
    const url = emailOrName.includes("@")
      ? `/api/families/email?email=${encodeURIComponent(emailOrName)}`
      : `/api/families/${encodeURIComponent(emailOrName)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(setMembers)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMembers(false));
  }, []);

  useEffect(() => {
    if (!isKursusleder && selectedFamily && selectedFamily.includes("@")) {
      setLoadingMembers(true);
      setError(null);
      const url = `/api/families/email?email=${encodeURIComponent(selectedFamily)}`;
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then(setMembers)
        .catch((err) => setError(err.message))
        .finally(() => setLoadingMembers(false));
    }
  }, [isKursusleder, selectedFamily, email]);

  const workshopOverview = useMemo(() => {
    const result: { slot: string; workshopName: string; participants: string[] }[] = [];
    for (const slot of ["workshop1", "workshop2", "workshop3", "workshop4", "voksen"] as const) {
      const grouped = new Map<string, string[]>();
      for (const member of members) {
        const workshopName = member[slot];
        if (workshopName) {
          const list = grouped.get(workshopName) || [];
          list.push(member.navn);
          grouped.set(workshopName, list);
        }
      }
      Array.from(grouped.entries()).forEach(([workshopName, participants]) => {
        result.push({
          slot: WORKSHOP_LABELS[slot],
          workshopName,
          participants,
        });
      });
    }
    return result.sort((a, b) => a.slot.localeCompare(b.slot) || a.workshopName.localeCompare(b.workshopName));
  }, [members]);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Dine workshops</h1>
          <p className="mt-1 text-slate-600">
            {isKursusleder
              ? "Søg efter email for at se workshop-tilmeldinger."
              : `Workshop-tilmeldinger for ${displayFamily || "din familie"}.`}
          </p>
        </header>

        {isKursusleder && (
          <div className="relative mb-8">
            <label htmlFor="family-search" className="mb-2 block text-sm font-medium text-slate-700">
              Søg efter email
            </label>
            <input
              id="family-search"
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSuggestions(true);
                setPickedFamily(null);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Søg efter email..."
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {suggestions.map((fam) => (
                  <li key={fam}>
                    <button
                      type="button"
                      onClick={() => loadFamily(fam)}
                      className="w-full px-4 py-2 text-left text-slate-800 hover:bg-amber-50"
                    >
                      {fam}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showSuggestions && search.trim() && suggestions.length === 0 && !loadingFamilies && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-500 shadow-lg">
                Ingen emails matcher &quot;{search}&quot;
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-medium">Fejl</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {loadingMembers && (
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
            Henter familiemedlemmer...
          </div>
        )}

        {!loadingMembers && displayFamily && members.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl bg-white p-6 shadow-lg">
              <h2 className="mb-6 text-xl font-semibold text-slate-800">
                Familiemedlemmer
              </h2>
              <div className="space-y-4">
                {members.map((member) => (
                  <div
                    key={member.navn}
                    className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
                  >
                    <h3 className="mb-3 font-semibold text-slate-800">{member.navn}</h3>
                    <dl className="space-y-2">
                      {(["workshop1", "workshop2", "workshop3", "workshop4", "voksen"] as const).map(
                        (key) => {
                          const value = member[key];
                          if (!value) return null;
                          return (
                            <div key={key} className="flex gap-2 text-sm">
                              <dt className="w-28 shrink-0 text-slate-500">
                                {WORKSHOP_LABELS[key]}:
                              </dt>
                              <dd className="text-slate-800">{value}</dd>
                            </div>
                          );
                        }
                      )}
                    </dl>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-lg">
              <h2 className="mb-6 text-xl font-semibold text-slate-800">
                Workshops – hvem er på hvad
              </h2>
              <div className="space-y-4">
                {workshopOverview.length === 0 ? (
                  <p className="text-slate-500">Ingen workshops tilmeldt.</p>
                ) : (
                  workshopOverview.map(({ slot, workshopName, participants }) => (
                    <div
                      key={`${slot}-${workshopName}`}
                      className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
                    >
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                        {slot}
                      </p>
                      <h3 className="mb-2 font-semibold text-slate-800">{workshopName}</h3>
                      <ul className="space-y-1 text-sm text-slate-600">
                        {participants.map((p) => (
                          <li key={p}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {!loadingMembers && isKursusleder && !pickedFamily && (
          <p className="text-slate-500">Søg efter en email ovenfor for at se tilmeldinger.</p>
        )}

        {!loadingMembers && !isKursusleder && selectedFamily && members.length === 0 && !error && (
          <p className="text-slate-500">Ingen familiemedlemmer fundet.</p>
        )}
      </div>
    </main>
  );
}
