"use client";

import { useEffect, useMemo, useState } from "react";
import { useFamily } from "@/context/FamilyContext";
import { useAuth } from "@/context/AuthContext";

interface FamilyMember {
  navn: string;
  workshop1: string | null;
  workshop2: string | null;
  workshop3: string | null;
  workshop4: string | null;
  voksen: string | null;
  aftengrupper: string | null;
}

interface AdminAssignedWorkshop {
  slot: "workshop1" | "workshop2" | "workshop3" | "workshop4" | "voksen";
  workshopName: string;
  count: number;
  roles: ("underviser" | "hjaelper" | "alle")[];
  underviser: string | null;
  hjaelpere: string | null;
  lokale: string | null;
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
  const { email, adminNavn } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [familieloebInfo, setFamilieloebInfo] = useState<{ holdnavn: string; membersText: string; message: string } | null>(null);
  const [familieloebLoading, setFamilieloebLoading] = useState(false);
  const [myWorkshops, setMyWorkshops] = useState<AdminAssignedWorkshop[]>([]);
  const [myWorkshopsLoading, setMyWorkshopsLoading] = useState(false);

  const displayFamily = selectedFamily;

  useEffect(() => {
    if (isKursusleder) {
      if (!email) return;
      setMyWorkshopsLoading(true);
      setError(null);
      fetch(`/api/my-workshops?email=${encodeURIComponent(email)}`)
        .then((res) => {
          if (!res.ok) {
            return res.json().then((body) => {
              throw new Error(body.error || res.statusText);
            });
          }
          return res.json();
        })
        .then((data) => setMyWorkshops(Array.isArray(data?.workshops) ? data.workshops : []))
        .catch((err) => setError(err.message))
        .finally(() => setMyWorkshopsLoading(false));
    }
  }, [isKursusleder, email]);

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

  useEffect(() => {
    if (isKursusleder || !selectedFamily || !selectedFamily.includes("@")) {
      setFamilieloebInfo(null);
      return;
    }
    setFamilieloebLoading(true);
    fetch(`/api/familieloeb?email=${encodeURIComponent(selectedFamily)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.holdnavn && data?.membersText) {
          setFamilieloebInfo(data);
        } else {
          setFamilieloebInfo(null);
        }
      })
      .catch(() => setFamilieloebInfo(null))
      .finally(() => setFamilieloebLoading(false));
  }, [isKursusleder, selectedFamily]);

  const familieloebFamiliesForDisplay = useMemo(() => {
    if (!familieloebInfo?.membersText) return [];
    return familieloebInfo.membersText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(":");
        if (idx === -1) return { familyName: line, members: [] as string[] };
        return {
          familyName: line.slice(0, idx).trim(),
          members: line
            .slice(idx + 1)
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean),
        };
      });
  }, [familieloebInfo]);

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

    const aftengruppeGrouped = new Map<string, string[]>();
    for (const member of members) {
      if (member.aftengrupper) {
        const list = aftengruppeGrouped.get(member.aftengrupper) || [];
        list.push(member.navn);
        aftengruppeGrouped.set(member.aftengrupper, list);
      }
    }
    Array.from(aftengruppeGrouped.entries()).forEach(([gruppeName, participants]) => {
      result.push({
        slot: "Aftengruppe",
        workshopName: gruppeName,
        participants,
      });
    });

    return result.sort((a, b) => a.slot.localeCompare(b.slot) || a.workshopName.localeCompare(b.workshopName));
  }, [members]);

  const myWorkshopsBySlot = useMemo(() => {
    const grouped = new Map<string, AdminAssignedWorkshop[]>();
    for (const item of myWorkshops) {
      const list = grouped.get(item.slot) || [];
      list.push(item);
      grouped.set(item.slot, list);
    }
    return grouped;
  }, [myWorkshops]);

  function formatRoleLabel(roles: AdminAssignedWorkshop["roles"]): string {
    if (roles.includes("alle")) return "Alle (fælles workshop)";
    return roles.map((role) => (role === "underviser" ? "Underviser" : "Hjælper")).join(" · ");
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Dine workshops</h1>
          <p className="mt-1 text-slate-600">
            {isKursusleder
              ? adminNavn
                ? `Workshops hvor ${adminNavn} er underviser eller hjælper.`
                : "Tilføj dit navn under «Navne» i Brugere-tabellen for at se dine workshops."
              : `Workshop-tilmeldinger for ${displayFamily || "din familie"}.`}
          </p>
        </header>

        {isKursusleder ? (
          <>
            {error && (
              <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
                <p className="font-medium">Fejl</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            )}

            {myWorkshopsLoading && (
              <p className="text-slate-500">Henter dine workshops...</p>
            )}

            {!myWorkshopsLoading && !adminNavn && (
              <p className="text-slate-500">
                Der er ikke sat et navn på din bruger endnu. Brug Workshopoversigt for at se alle
                workshops.
              </p>
            )}

            {!myWorkshopsLoading && adminNavn && myWorkshops.length === 0 && !error && (
              <p className="text-slate-500">
                Ingen workshops fundet hvor du er med. Tjek at dit navn i Brugere matcher
                Underviser/Hjælpere i Workshopbackend.
              </p>
            )}

            {!myWorkshopsLoading && myWorkshops.length > 0 && (
              <div className="space-y-6">
                {(["workshop1", "workshop2", "workshop3", "workshop4", "voksen"] as const).map(
                  (slot) => {
                    const items = myWorkshopsBySlot.get(slot);
                    if (!items?.length) return null;
                    return (
                      <section key={slot} className="rounded-xl bg-white p-6 shadow-lg">
                        <h2 className="mb-4 text-xl font-semibold text-slate-800">
                          {WORKSHOP_LABELS[slot]}
                        </h2>
                        <div className="space-y-4">
                          {items.map((item) => (
                            <div
                              key={`${slot}-${item.workshopName}`}
                              className="rounded-lg border border-slate-100 bg-slate-50/50 p-4"
                            >
                              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                <h3 className="font-semibold text-slate-800">{item.workshopName}</h3>
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                                  {formatRoleLabel(item.roles)}
                                </span>
                              </div>
                              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                                <div>
                                  <dt className="text-slate-500">Underviser</dt>
                                  <dd className="text-slate-800">{item.underviser || "—"}</dd>
                                </div>
                                <div>
                                  <dt className="text-slate-500">Hjælpere</dt>
                                  <dd className="text-slate-800">{item.hjaelpere || "—"}</dd>
                                </div>
                                <div>
                                  <dt className="text-slate-500">Lokale</dt>
                                  <dd className="text-slate-800">{item.lokale || "—"}</dd>
                                </div>
                                <div>
                                  <dt className="text-slate-500">Tilmeldte</dt>
                                  <dd className="text-slate-800">{item.count}</dd>
                                </div>
                              </dl>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }
                )}
              </div>
            )}
          </>
        ) : (
          <>
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
                      {member.aftengrupper && (
                        <div className="flex gap-2 text-sm">
                          <dt className="w-28 shrink-0 text-slate-500">Aftengruppe:</dt>
                          <dd className="text-slate-800">{member.aftengrupper}</dd>
                        </div>
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

        {!loadingMembers && !isKursusleder && selectedFamily && members.length === 0 && !error && (
          <p className="text-slate-500">Ingen familiemedlemmer fundet.</p>
        )}

        {!isKursusleder && (
          <section className="mt-8 rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-3 text-xl font-semibold text-slate-800">Familieløbet</h2>
            {familieloebLoading ? (
              <p className="text-slate-500">Finder jeres hold...</p>
            ) : familieloebInfo ? (
              <div className="space-y-4">
                <p className="font-medium text-slate-700">{familieloebInfo.message}</p>
                <div className="space-y-4 text-sm text-slate-700">
                  {familieloebFamiliesForDisplay.map((family) => (
                    <div key={family.familyName}>
                      <p className="font-semibold text-slate-800">{family.familyName}</p>
                      <ul className="mt-1 space-y-1">
                        {family.members.map((m) => (
                          <li key={`${family.familyName}-${m}`}>• {m}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-slate-500">Holdfordeling er ikke klar endnu.</p>
            )}
          </section>
        )}
          </>
        )}
      </div>
    </main>
  );
}
