"use client";

import { useEffect, useState } from "react";
import { useFamily } from "@/context/FamilyContext";
import { useAuth } from "@/context/AuthContext";

interface WorkshopCount {
  name: string;
  count: number;
}

interface WorkshopParticipantDetail {
  navn: string;
  alder: string | null;
  type: string | null;
}

interface WorkshopFamilyGroup {
  email: string;
  familie: string | null;
  members: WorkshopParticipantDetail[];
}

interface WorkshopBackendInfo {
  underviser: string | null;
  hjaelpere: string | null;
  lokale: string | null;
}

const WORKSHOP_LABELS: Record<string, string> = {
  workshop1: "Workshop 1",
  workshop2: "Workshop 2",
  workshop3: "Workshop 3",
  workshop4: "Workshop 4",
  voksen: "Workshop Forældre (Voksen)",
  aftengrupper: "Aftengrupper",
  gyserløb: "Gyserløb",
  sheltertur: "Sheltertur",
};

const WORKSHOP_TABS = [
  "workshop1",
  "workshop2",
  "workshop3",
  "workshop4",
  "voksen",
  "aftengrupper",
  "gyserløb",
  "sheltertur",
] as const;

const ACTIVITY_TABS = new Set(["aftengrupper", "gyserløb", "sheltertur"]);

export default function AntalPage() {
  const { isKursusleder } = useFamily();
  const { email } = useAuth();
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>("workshop1");
  const [data, setData] = useState<WorkshopCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [participantFamilies, setParticipantFamilies] = useState<WorkshopFamilyGroup[]>([]);
  const [workshopBackend, setWorkshopBackend] = useState<WorkshopBackendInfo | null>(null);
  const [myRoles, setMyRoles] = useState<("underviser" | "hjaelper" | "alle")[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedOption(null);
    setParticipantFamilies([]);
    setWorkshopBackend(null);
    setMyRoles([]);
    setParticipantError(null);

    fetch(`/api/workshops?workshop=${selectedWorkshop}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedWorkshop]);

  function loadParticipants(optionName: string) {
    if (!isKursusleder || !email) return;
    setSelectedOption(optionName);
    setLoadingParticipants(true);
    setParticipantError(null);
    setParticipantFamilies([]);
    setWorkshopBackend(null);
    setMyRoles([]);

    fetch(
      `/api/workshops?workshop=${selectedWorkshop}&option=${encodeURIComponent(optionName)}&email=${encodeURIComponent(email)}`
    )
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body.error || res.statusText);
          });
        }
        return res.json();
      })
      .then(
        (body: {
          families: WorkshopFamilyGroup[];
          backend: WorkshopBackendInfo | null;
          roles?: ("underviser" | "hjaelper" | "alle")[];
        }) => {
        setParticipantFamilies(body.families ?? []);
        setWorkshopBackend(body.backend ?? null);
        setMyRoles(body.roles ?? []);
      }
      )
      .catch((err) => setParticipantError(err.message))
      .finally(() => setLoadingParticipants(false));
  }

  const totalParticipants = data.reduce((sum, w) => sum + w.count, 0);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Workshops</h1>
          <p className="mt-1 text-slate-600">Antal tilmeldte pr. workshop-valg.</p>
          {isKursusleder && (
            <p className="mt-2 text-sm text-amber-700">
              Tryk på en workshop, aftengruppe, gyserløb eller sheltertur for at se deltagere grupperet efter familie.
            </p>
          )}
        </header>

        <nav className="mb-6 flex flex-wrap gap-2">
          {WORKSHOP_TABS.map((key) => (
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
            ))}
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
            <p className="text-slate-500">
              {selectedWorkshop === "aftengrupper"
                ? "Ingen tilmeldinger fundet til aftengrupper."
                : selectedWorkshop === "gyserløb"
                  ? "Ingen tilmeldinger fundet til gyserløb."
                  : selectedWorkshop === "sheltertur"
                    ? "Ingen tilmeldinger fundet til sheltertur."
                    : "Ingen tilmeldinger fundet for denne workshop."}
            </p>
          )}

          {!loading && !error && data.length > 0 && (
            <>
              <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2">
                <span className="font-medium text-slate-700">I alt tilmeldte</span>
                <span className="text-2xl font-bold text-amber-600">{totalParticipants}</span>
              </div>

              <ul className="divide-y divide-slate-100">
                {data.map((workshop) => {
                  const isSelected = selectedOption === workshop.name;
                  const RowTag = isKursusleder ? "button" : "div";
                  return (
                    <li key={workshop.name}>
                      <RowTag
                        type={isKursusleder ? "button" : undefined}
                        onClick={isKursusleder ? () => loadParticipants(workshop.name) : undefined}
                        className={`flex w-full items-center justify-between py-3 text-left first:pt-0 ${
                          isKursusleder
                            ? `cursor-pointer rounded-lg px-2 transition-colors hover:bg-amber-50 ${
                                isSelected ? "bg-amber-50 ring-1 ring-amber-200" : ""
                              }`
                            : ""
                        }`}
                      >
                        <span className="font-medium text-slate-800">{workshop.name}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                          {workshop.count}
                        </span>
                      </RowTag>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {isKursusleder && selectedOption && (
          <section className="mt-6 rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Deltagere</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedOption} · {WORKSHOP_LABELS[selectedWorkshop]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedOption(null);
                  setParticipantFamilies([]);
                  setWorkshopBackend(null);
                  setMyRoles([]);
                  setParticipantError(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Luk
              </button>
            </div>

            {!loadingParticipants && !participantError && !ACTIVITY_TABS.has(selectedWorkshop) && myRoles.length > 0 && (
              <p className="mb-4 text-sm font-medium text-amber-700">
                Din rolle:{" "}
                {myRoles.includes("alle")
                  ? "Alle (fælles workshop)"
                  : myRoles
                      .map((role) => (role === "underviser" ? "Underviser" : "Hjælper"))
                      .join(" · ")}
              </p>
            )}

            {!loadingParticipants && !participantError && !ACTIVITY_TABS.has(selectedWorkshop) && (
              <dl className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Underviser
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {workshopBackend?.underviser || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Hjælpere
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {workshopBackend?.hjaelpere || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Lokale
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {workshopBackend?.lokale || "—"}
                  </dd>
                </div>
              </dl>
            )}

            {loadingParticipants && (
              <p className="text-slate-500">Henter deltagere...</p>
            )}

            {participantError && (
              <div className="rounded-lg bg-red-50 p-4 text-red-700">
                <p className="text-sm">{participantError}</p>
              </div>
            )}

            {!loadingParticipants && !participantError && participantFamilies.length === 0 && (
              <p className="text-slate-500">Ingen deltagere fundet.</p>
            )}

            {!loadingParticipants && !participantError && participantFamilies.length > 0 && (
              <div className="space-y-4">
                {participantFamilies.map((family) => (
                  <div
                    key={family.email}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="font-semibold text-slate-800">
                      {family.familie || family.email}
                    </p>
                    {family.familie && (
                      <p className="text-xs text-slate-500">{family.email}</p>
                    )}
                    <ul className="mt-2 space-y-1">
                      {family.members.map((member) => (
                        <li key={`${family.email}-${member.navn}`} className="text-sm text-slate-700">
                          • {member.navn}
                          {member.type ? ` (${member.type})` : ""}
                          {member.alder ? ` · ${member.alder}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
