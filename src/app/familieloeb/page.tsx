"use client";

import { useEffect, useState } from "react";
import { useFamily } from "@/context/FamilyContext";
import { useRouter } from "next/navigation";

interface FamilieloebFamily {
  familyName: string;
  members: string[];
}

interface FamilieloebHold {
  recordId: string;
  holdnavn: string;
  membersText: string;
  families: FamilieloebFamily[];
}

export default function FamilieloebPage() {
  const { isKursusleder } = useFamily();
  const router = useRouter();
  const [familieloebHolds, setFamilieloebHolds] = useState<FamilieloebHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingFamily, setMovingFamily] = useState<{ familyName: string; fromHold: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  function loadHolds() {
    setLoading(true);
    setError(null);
    fetch("/api/familieloeb?all=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setFamilieloebHolds(Array.isArray(data?.holds) ? data.holds : []))
      .catch(() => {
        setFamilieloebHolds([]);
        setError("Kunne ikke hente hold");
      })
      .finally(() => setLoading(false));
  }

  async function moveFamilyToHold(toHold: string) {
    if (!movingFamily || movingFamily.fromHold === toHold || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/familieloeb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "moveFamily",
          familyName: movingFamily.familyName,
          fromHold: movingFamily.fromHold,
          toHold,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kunne ikke flytte familie");
      } else {
        setFamilieloebHolds(Array.isArray(data.holds) ? data.holds : []);
      }
    } catch {
      setError("Kunne ikke flytte familie");
    } finally {
      setMovingFamily(null);
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!isKursusleder) {
      router.replace("/tilmeldte");
    }
  }, [isKursusleder, router]);

  useEffect(() => {
    if (!isKursusleder) return;
    loadHolds();
  }, [isKursusleder]);

  if (!isKursusleder) {
    return null;
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Familieløbet</h1>
              <p className="mt-1 text-slate-600">
                Træk en familie til et andet hold for at flytte den. Ændringer gemmes i Airtable.
              </p>
            </div>
            <button
              type="button"
              onClick={loadHolds}
              disabled={loading || saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Genindlæs hold
            </button>
          </div>
          {movingFamily && (
            <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Flytter <span className="font-semibold">{movingFamily.familyName}</span> fra{" "}
              {movingFamily.fromHold} — slip på et andet hold.
            </p>
          )}
        </header>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Henter hold...</p>
        ) : familieloebHolds.length === 0 ? (
          <p className="text-slate-500">Ingen hold fundet endnu.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {familieloebHolds.map((hold) => (
              <div
                key={hold.recordId}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void moveFamilyToHold(hold.holdnavn);
                }}
                className={`rounded-xl border bg-white p-4 shadow-lg transition-colors ${
                  movingFamily && movingFamily.fromHold !== hold.holdnavn
                    ? "border-amber-300 ring-2 ring-amber-100"
                    : "border-slate-200"
                }`}
              >
                <h2 className="mb-3 text-lg font-semibold text-slate-800">{hold.holdnavn}</h2>
                <div className="space-y-2">
                  {hold.families.map((family) => (
                    <div
                      key={`${hold.holdnavn}-${family.familyName}`}
                      draggable={!saving}
                      onDragStart={(e) => {
                        setMovingFamily({ familyName: family.familyName, fromHold: hold.holdnavn });
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className={`cursor-move rounded-lg border border-slate-200 bg-slate-50 p-3 ${
                        movingFamily?.familyName === family.familyName ? "opacity-50" : ""
                      }`}
                    >
                      <p className="font-medium text-slate-800">{family.familyName}</p>
                      <ul className="mt-1 space-y-1 text-sm text-slate-600">
                        {family.members.map((m) => (
                          <li key={`${family.familyName}-${m}`}>• {m}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
