"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_KURSUS_YEAR } from "@/lib/kursus-year";
import type { WorkshopSlotKey } from "@/lib/airtable";

const SLOT_KEYS = ["workshop1", "workshop2", "workshop3", "workshop4"] as const;
type MainWorkshopSlot = (typeof SLOT_KEYS)[number];
const SLOT_LABELS: Record<WorkshopSlotKey, string> = {
  workshop1: "Workshop 1",
  workshop2: "Workshop 2",
  workshop3: "Workshop 3",
  workshop4: "Workshop 4",
  voksen: "Forældreworkshop",
};

interface FamilyMember {
  navn: string;
  alder: number | null;
  workshop1: string | null;
  workshop2: string | null;
  workshop3: string | null;
  workshop4: string | null;
}

interface WorkshopOptionDetail {
  name: string;
  max: number | null;
  current: number;
  remaining: number | null;
  soldOut: boolean;
  unit: "person" | "family";
}

interface CapacityConflict {
  slot: WorkshopSlotKey;
  workshopName: string;
  requested: number;
  available: number;
  unit: "person" | "family";
  memberNames: string[];
}

type Step = "family" | "workshops";

type WorkshopPersonDraft = Record<MainWorkshopSlot, string>;
type WorkshopDraft = Record<string, WorkshopPersonDraft>;

function optionLabel(opt: WorkshopOptionDetail): string {
  if (opt.soldOut) return `${opt.name} (fuldt booket)`;
  if (opt.remaining !== null) {
    const unitLabel = opt.unit === "family" ? "familier" : "pladser";
    return `${opt.name} (${opt.remaining} ledige ${unitLabel})`;
  }
  return opt.name;
}

export default function WorkshopTilmeldingPage() {
  const router = useRouter();
  const { email, familyName, setAuth, isAdmin, isAuthReady, needsWorkshopRegistration } =
    useAuth();
  const [step, setStep] = useState<Step>("family");
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [options, setOptions] = useState<Record<WorkshopSlotKey, WorkshopOptionDetail[]>>({
    workshop1: [],
    workshop2: [],
    workshop3: [],
    workshop4: [],
    voksen: [],
  });
  const [draft, setDraft] = useState<WorkshopDraft>({});
  const [fornavn, setFornavn] = useState("");
  const [alder, setAlder] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<CapacityConflict[] | null>(null);

  const goToApp = useCallback(
    (syncAuth: boolean) => {
      if (syncAuth && email) {
        setAuth(email, familyName || email, false);
      }
      router.replace("/tilmeldte");
    },
    [email, familyName, setAuth, router]
  );

  const goToAppRef = useRef(goToApp);
  goToAppRef.current = goToApp;

  const syncDraftFromMembers = useCallback((mems: FamilyMember[]) => {
    const next: WorkshopDraft = {};
    for (const m of mems) {
      next[m.navn] = {
        workshop1: m.workshop1 || "",
        workshop2: m.workshop2 || "",
        workshop3: m.workshop3 || "",
        workshop4: m.workshop4 || "",
      };
    }
    setDraft(next);
  }, []);

  const applyMembersList = useCallback(
    (list: FamilyMember[]) => {
      setMembers(list);
      syncDraftFromMembers(list);
      const hasRoster = list.length > 0;
      const workshopsDone =
        hasRoster &&
        list.every((m) => m.workshop1 && m.workshop2 && m.workshop3 && m.workshop4);
      const workshopsStarted = list.some(
        (m) => m.workshop1 || m.workshop2 || m.workshop3 || m.workshop4
      );
      if (workshopsDone) {
        goToAppRef.current(true);
        return;
      }
      if (hasRoster && workshopsStarted) setStep("workshops");
    },
    [syncDraftFromMembers]
  );

  const fetchMembers = useCallback(async (): Promise<FamilyMember[]> => {
    if (!email) return [];
    try {
      const res = await fetch(`/api/families/email?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body?.error === "string" ? body.error : "Kunne ikke hente familiemedlemmer"
        );
      }
      const data = await res.json();
      const list = Array.isArray(data) ? (data as FamilyMember[]) : [];
      applyMembersList(list);
      return list;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente familiemedlemmer");
      return [];
    }
  }, [email, applyMembersList]);

  const fetchOptions = useCallback(() => {
    return fetch(`/api/workshop-options?year=${DEFAULT_KURSUS_YEAR}&detailed=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.detailed) {
          setOptions({
            workshop1: data.detailed.workshop1 || [],
            workshop2: data.detailed.workshop2 || [],
            workshop3: data.detailed.workshop3 || [],
            workshop4: data.detailed.workshop4 || [],
            voksen: data.detailed.voksen || [],
          });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!email) {
      router.replace("/login");
      return;
    }
    if (isAdmin) {
      router.replace("/program");
      return;
    }
    if (!needsWorkshopRegistration) {
      goToApp(false);
    }
  }, [isAuthReady, email, isAdmin, needsWorkshopRegistration, router, goToApp]);

  useEffect(() => {
    if (!isAuthReady || !email || isAdmin) return;
    setLoading(true);
    Promise.all([fetchMembers(), fetchOptions()]).finally(() => setLoading(false));
  }, [isAuthReady, email, isAdmin, fetchMembers, fetchOptions]);

  useEffect(() => {
    if (step !== "workshops" || loading) return;
    if (members.length === 0) {
      setStep("family");
      setError((prev) => prev ?? "Tilføj familiemedlemmer under Familie, før I vælger workshops.");
    }
  }, [step, loading, members.length]);

  const resetFamilyForm = useCallback(() => {
    setFornavn("");
    setAlder("");
    setError(null);
  }, []);

  const submitFamily = useCallback(
    async (continueToWorkshops: boolean) => {
      if (!email) return;
      if (continueToWorkshops && !fornavn.trim() && !alder.trim()) {
        const list = await fetchMembers();
        if (list.length === 0) {
          setError("Tilføj mindst én person i familien, før I vælger workshops.");
          return;
        }
        setStep("workshops");
        await fetchOptions();
        return;
      }
      if (!fornavn.trim() || !alder.trim()) {
        setError("Udfyld fornavn og alder");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/workshop-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "roster",
            email,
            navn: fornavn.trim(),
            alder: alder.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fejl ved tilmelding");

        const list = await fetchMembers();
        resetFamilyForm();
        if (continueToWorkshops) {
          if (list.length === 0) {
            setError("Kunne ikke gemme familiemedlem — prøv igen.");
            return;
          }
          setStep("workshops");
          await fetchOptions();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fejl");
      } finally {
        setSubmitting(false);
      }
    },
    [email, fornavn, alder, fetchMembers, fetchOptions, resetFamilyForm]
  );

  const membersPayload = useMemo(
    () =>
      members.map((m) => ({
        navn: m.navn,
        workshop1: draft[m.navn]?.workshop1 || "",
        workshop2: draft[m.navn]?.workshop2 || "",
        workshop3: draft[m.navn]?.workshop3 || "",
        workshop4: draft[m.navn]?.workshop4 || "",
      })),
    [members, draft]
  );

  const submitWorkshops = useCallback(
    async (acceptPartial = false, partialChoices?: Record<string, string[]>) => {
      if (!email) return;
      const incomplete = members.some((m) => {
        const d = draft[m.navn];
        return !d?.workshop1 || !d?.workshop2 || !d?.workshop3 || !d?.workshop4;
      });
      if (incomplete) {
        setError("Vælg workshop 1–4 for hver person i familien");
        return;
      }

      setSubmitting(true);
      setError(null);
      setConflicts(null);
      try {
        const res = await fetch("/api/workshop-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "workshops",
            email,
            members: membersPayload,
            acceptPartial,
            partialChoices,
          }),
        });
        const data = await res.json();
        if (res.status === 409 && data.code === "PARTIAL_CAPACITY") {
          setConflicts(data.conflicts as CapacityConflict[]);
          return;
        }
        if (!res.ok) throw new Error(data.error || "Fejl ved workshop-tilmelding");

        goToApp(true);
        await fetchOptions();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fejl");
      } finally {
        setSubmitting(false);
      }
    },
    [email, members, draft, membersPayload, goToApp, fetchOptions]
  );

  const acceptPartialForConflict = useCallback(
    (conflict: CapacityConflict) => {
      const partialChoices: Record<string, string[]> = {};
      const key = `${conflict.slot}::${conflict.workshopName}`;
      partialChoices[key] = conflict.memberNames.slice(0, conflict.available);
      void submitWorkshops(true, partialChoices);
    },
    [submitWorkshops]
  );

  if (!email) return null;

  return (
    <main className="min-h-screen p-6 pb-24">
      <div className="mx-auto max-w-2xl">
        {step === "family" && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-slate-800">Familie</h1>
            <p className="mb-6 text-sm text-slate-600">
              Angiv <strong>fornavn</strong> og <strong>alder</strong> for hver person. Derefter vælger I
              workshops.
            </p>

            {members.length > 0 && (
              <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Tilføjet</h2>
                <ul className="divide-y divide-slate-100 text-sm text-slate-800">
                  {members.map((m) => (
                    <li key={m.navn} className="flex justify-between py-2">
                      <span>{m.navn}</span>
                      <span className="text-slate-500">
                        {m.alder != null ? `${m.alder} år` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {loading ? (
              <p className="text-slate-500">Henter...</p>
            ) : (
              <form
                onSubmit={(e) => e.preventDefault()}
                className="space-y-4 rounded-xl bg-white p-6 shadow-lg"
              >
                <FamilyMemberFields
                  fornavn={fornavn}
                  alder={alder}
                  setFornavn={setFornavn}
                  setAlder={setAlder}
                />
                {error && <ErrorBox message={error} />}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void submitFamily(false)}
                    disabled={submitting || !fornavn.trim() || !alder.trim()}
                    className="flex-1 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Gem og tilføj næste
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitFamily(true)}
                    disabled={
                      submitting ||
                      (members.length === 0 && (!fornavn.trim() || !alder.trim()))
                    }
                    className="flex-1 rounded-lg bg-amber-500 px-4 py-3 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    Fortsæt til workshopvalg
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {step === "workshops" && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-slate-800">Vælg workshops</h1>
            <p className="mb-4 text-sm text-slate-600">
              Vælg én workshop i hvert hold for hver person. Fuldt bookede workshops kan ikke vælges.
            </p>

            {loading ? (
              <p className="text-slate-500">Henter workshops...</p>
            ) : members.length === 0 ? (
              <p className="text-slate-600">
                Ingen familiemedlemmer fundet. Gå tilbage til fanen Familie og tilføj dem først.
              </p>
            ) : (
              <div className="space-y-6">
                {members.map((member) => (
                  <section
                    key={member.navn}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <h2 className="mb-3 font-semibold text-slate-800">
                      {member.navn}
                      {member.alder != null && (
                        <span className="ml-2 text-sm font-normal text-slate-500">
                          {member.alder} år
                        </span>
                      )}
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {SLOT_KEYS.map((slot) => (
                        <label key={slot} className="block text-sm">
                          <span className="mb-1 block font-medium text-slate-700">
                            {SLOT_LABELS[slot]}
                          </span>
                          <select
                            value={draft[member.navn]?.[slot] || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setDraft((prev) => ({
                                ...prev,
                                [member.navn]: {
                                  ...(prev[member.navn] || {
                                    workshop1: "",
                                    workshop2: "",
                                    workshop3: "",
                                    workshop4: "",
                                  }),
                                  [slot]: value,
                                },
                              }));
                            }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                          >
                            <option value="">— Vælg —</option>
                            {(options[slot] || []).map((opt) => (
                              <option key={opt.name} value={opt.name} disabled={opt.soldOut}>
                                {optionLabel(opt)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </section>
                ))}

                {error && <ErrorBox message={error} />}

                <button
                  type="button"
                  onClick={() => void submitWorkshops(false)}
                  disabled={submitting || members.length === 0}
                  className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {submitting ? "Gemmer..." : "Bekræft workshopvalg"}
                </button>

                <button
                  type="button"
                  onClick={() => setStep("family")}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  Tilbage til familie
                </button>
              </div>
            )}
          </>
        )}

        {conflicts && conflicts.length > 0 && (
          <PartialCapacityDialog
            conflicts={conflicts}
            onAccept={acceptPartialForConflict}
            onDismiss={() => setConflicts(null)}
          />
        )}
      </div>
    </main>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}

function FamilyMemberFields(props: {
  fornavn: string;
  alder: string;
  setFornavn: (v: string) => void;
  setAlder: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label htmlFor="fornavn" className="mb-1 block text-sm font-medium text-slate-700">
          Fornavn
        </label>
        <input
          id="fornavn"
          type="text"
          value={props.fornavn}
          onChange={(e) => props.setFornavn(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2"
          placeholder="Fx Anna"
          autoComplete="given-name"
        />
      </div>
      <div>
        <label htmlFor="alder" className="mb-1 block text-sm font-medium text-slate-700">
          Alder
        </label>
        <input
          id="alder"
          type="number"
          min={0}
          max={120}
          value={props.alder}
          onChange={(e) => props.setAlder(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2"
          placeholder="Fx 12"
          inputMode="numeric"
        />
      </div>
    </>
  );
}

function PartialCapacityDialog({
  conflicts,
  onAccept,
  onDismiss,
}: {
  conflicts: CapacityConflict[];
  onAccept: (c: CapacityConflict) => void;
  onDismiss: () => void;
}) {
  const conflict = conflicts[0];
  const unitLabel = conflict.unit === "family" ? "familiepladser" : "pladser";
  const names = conflict.memberNames.join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-bold text-slate-800">Ikke nok pladser</h2>
        <p className="mb-4 text-sm text-slate-600">
          I ønskede <strong>{conflict.workshopName}</strong> ({SLOT_LABELS[conflict.slot]}) for{" "}
          {conflict.unit === "family" ? "jeres familie" : names}.
          <br />
          Der er kun <strong>{conflict.available}</strong> ledige {unitLabel}.
        </p>
        {conflict.available > 0 ? (
          <p className="mb-4 text-sm text-slate-600">
            Vil I tilmelde{" "}
            {conflict.unit === "family"
              ? "én familieplads"
              : `de første ${conflict.available}: ${conflict.memberNames.slice(0, conflict.available).join(", ")}`}
            , eller gå tilbage og vælge en anden workshop?
          </p>
        ) : (
          <p className="mb-4 text-sm text-slate-600">
            Workshoppen er fuldt booket. Vælg venligst en anden workshop.
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Vælg anden workshop
          </button>
          {conflict.available > 0 && (
            <button
              type="button"
              onClick={() => onAccept(conflict)}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white"
            >
              Tilmeld ledige pladser
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
