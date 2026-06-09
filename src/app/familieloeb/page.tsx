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

  useEffect(() => {
    if (!isKursusleder) {
      router.replace("/tilmeldte");
    }
  }, [isKursusleder, router]);

  useEffect(() => {
    if (!isKursusleder) return;
    setLoading(true);
    fetch("/api/familieloeb?all=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setFamilieloebHolds(Array.isArray(data?.holds) ? data.holds : []))
      .catch(() => setFamilieloebHolds([]))
      .finally(() => setLoading(false));
  }, [isKursusleder]);

  if (!isKursusleder) {
    return null;
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Familieløbet</h1>
          <p className="mt-1 text-slate-600">
            Oversigt over alle hold. Træk en familie fra et hold til et andet for at flytte den.
          </p>
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={async () => {
                  if (!movingFamily || movingFamily.fromHold === hold.holdnavn) return;
                  const res = await fetch("/api/familieloeb", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "moveFamily",
                      familyName: movingFamily.familyName,
                      fromHold: movingFamily.fromHold,
                      toHold: hold.holdnavn,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    setError(data.error || "Kunne ikke flytte familie");
                  } else {
                    setFamilieloebHolds(Array.isArray(data.holds) ? data.holds : []);
                  }
                  setMovingFamily(null);
                }}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
              >
                <h2 className="mb-3 text-lg font-semibold text-slate-800">{hold.holdnavn}</h2>
                <div className="space-y-2">
                  {hold.families.map((family) => (
                    <div
                      key={`${hold.holdnavn}-${family.familyName}`}
                      draggable
                      onDragStart={() =>
                        setMovingFamily({ familyName: family.familyName, fromHold: hold.holdnavn })
                      }
                      className="cursor-move rounded-lg border border-slate-200 bg-slate-50 p-3"
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
