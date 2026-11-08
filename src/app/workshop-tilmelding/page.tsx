"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_KURSUS_YEAR } from "@/lib/kursus-year";
import type { WorkshopSlotKey } from "@/lib/airtable";
import {
  type AdultEscortGap,
  type ExternalEscortDraft,
  ADULT_MIN_AGE,
  ESCORT_SLOT_LABELS,
  YOUNG_CHILD_AGE_MAX_EXCLUSIVE,
  getWorkshopAgeRule,
  isWorkshopBlockedForMember,
  listAdultEscortGaps,
  listWorkshopMinAgeViolations,
  mergeRosterWithClientMembers,
  memberIsAdult,
  memberNeedsAdultOnWorkshop,
  parseExternalEscortName,
} from "@/lib/workshop-adult-escort";

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
  ledsager1?: string | null;
  ledsager2?: string | null;
  ledsager3?: string | null;
  ledsager4?: string | null;
  type?: string | null;
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

function optionLabel(opt: WorkshopOptionDetail, member: FamilyMember): string {
  if (isWorkshopBlockedForMember(member, opt.name)) {
    const rule = getWorkshopAgeRule(opt.name);
    return `${opt.name} (min. ${rule?.minAge ?? "?"} år)`;
  }
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
  const [escortQueue, setEscortQueue] = useState<AdultEscortGap[]>([]);
  const [externalEscorts, setExternalEscorts] = useState<ExternalEscortDraft>({});

  const goToApp = useCallback(
    async (syncAuth: boolean) => {
      if (syncAuth && email) {
        try {
          const res = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", brugernavn: email }),
          });
          const data = res.ok ? await res.json() : null;
          setAuth(
            email,
            data?.familyName ?? familyName ?? email,
            data ? Boolean(data.needsWorkshopRegistration) : false,
            Boolean(data?.isAdmin),
            data?.adminNavn ?? null
          );
        } catch {
          setAuth(email, familyName || email, false);
        }
      }
      router.replace("/tilmeldte");
    },
    [email, familyName, setAuth, router]
  );

  const goToAppRef = useRef(goToApp);
  goToAppRef.current = goToApp;
  const membersFetchGen = useRef(0);

  const syncDraftFromMembers = useCallback((mems: FamilyMember[]) => {
    const next: WorkshopDraft = {};
    const escorts: ExternalEscortDraft = {};
    const ledsagerBySlot: Record<MainWorkshopSlot, keyof FamilyMember> = {
      workshop1: "ledsager1",
      workshop2: "ledsager2",
      workshop3: "ledsager3",
      workshop4: "ledsager4",
    };
    for (const m of mems) {
      next[m.navn] = {
        workshop1: m.workshop1 || "",
        workshop2: m.workshop2 || "",
        workshop3: m.workshop3 || "",
        workshop4: m.workshop4 || "",
      };
      for (const slot of SLOT_KEYS) {
        const parsed = parseExternalEscortName(m[ledsagerBySlot[slot]] as string | null);
        if (parsed) {
          if (!escorts[m.navn]) escorts[m.navn] = {};
          escorts[m.navn][slot] = parsed;
        }
      }
    }
    setDraft(next);
    setExternalEscorts(escorts);
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
      }
    },
    [syncDraftFromMembers]
  );

  const fetchMembers = useCallback(
    async (options?: { setErrorOnFailure?: boolean }): Promise<FamilyMember[]> => {
      if (!email) return [];
      const gen = ++membersFetchGen.current;
      const setErrorOnFailure = options?.setErrorOnFailure !== false;
      try {
        const res = await fetch(`/api/families/email?email=${encodeURIComponent(email)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            typeof body?.error === "string" ? body.error : "Kunne ikke hente familiemedlemmer"
          );
        }
        const data = await res.json();
        const list = Array.isArray(data) ? (data as FamilyMember[]) : [];
        if (gen === membersFetchGen.current) {
          applyMembersList(list);
        }
        return list;
      } catch (err) {
        if (setErrorOnFailure && gen === membersFetchGen.current) {
          setError(err instanceof Error ? err.message : "Kunne ikke hente familiemedlemmer");
        }
        return [];
      }
    },
    [email, applyMembersList]
  );

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

      const hasCompleteForm = Boolean(fornavn.trim() && alder.trim());
      const formEmpty = !fornavn.trim() && !alder.trim();

      if (continueToWorkshops && (formEmpty || !hasCompleteForm)) {
        if (members.length > 0) {
          setError(null);
          resetFamilyForm();
          setStep("workshops");
          await fetchOptions();
          return;
        }
        if (formEmpty) {
          const list = await fetchMembers();
          if (list.length === 0) {
            setError("Tilføj mindst én person i familien, før I vælger workshops.");
            return;
          }
          setStep("workshops");
          await fetchOptions();
          return;
        }
        setError("Udfyld fornavn og alder");
        return;
      }

      if (!hasCompleteForm) {
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

        const savedMember = data.member as FamilyMember | undefined;
        let list = await fetchMembers({ setErrorOnFailure: false });
        if (list.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          list = await fetchMembers({ setErrorOnFailure: false });
        }
        if (list.length === 0 && savedMember?.navn?.trim()) {
          const key = savedMember.navn.trim().toLowerCase();
          list = [
            ...members.filter((m) => m.navn.trim().toLowerCase() !== key),
            {
              ...savedMember,
              workshop1: savedMember.workshop1 ?? null,
              workshop2: savedMember.workshop2 ?? null,
              workshop3: savedMember.workshop3 ?? null,
              workshop4: savedMember.workshop4 ?? null,
            },
          ].sort((a, b) => a.navn.localeCompare(b.navn, "da"));
          applyMembersList(list);
        }
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
    [email, fornavn, alder, members, fetchMembers, fetchOptions, resetFamilyForm, applyMembersList]
  );

  const membersPayload = useMemo(
    () =>
      members.map((m) => ({
        navn: m.navn,
        alder: m.alder,
        type: m.type ?? null,
        workshop1: draft[m.navn]?.workshop1 || "",
        workshop2: draft[m.navn]?.workshop2 || "",
        workshop3: draft[m.navn]?.workshop3 || "",
        workshop4: draft[m.navn]?.workshop4 || "",
        ledsager1: externalEscorts[m.navn]?.workshop1 || "",
        ledsager2: externalEscorts[m.navn]?.workshop2 || "",
        ledsager3: externalEscorts[m.navn]?.workshop3 || "",
        ledsager4: externalEscorts[m.navn]?.workshop4 || "",
      })),
    [members, draft, externalEscorts]
  );

  const adultsInFamily = useMemo(
    () => members.filter((m) => memberIsAdult(m)),
    [members]
  );

  const assignFamilyAdultToGap = useCallback(
    (gap: AdultEscortGap, adultNavn: string) => {
      setDraft((prev) => {
        const next: WorkshopDraft = {
          ...prev,
          [adultNavn]: {
            ...(prev[adultNavn] || {
              workshop1: "",
              workshop2: "",
              workshop3: "",
              workshop4: "",
            }),
            [gap.slot]: gap.workshopName,
          },
        };
        const gaps = listAdultEscortGaps(members, next, externalEscorts);
        setEscortQueue(gaps);
        return next;
      });
      setExternalEscorts((prev) => {
        const child = prev[gap.childNavn];
        if (!child?.[gap.slot]) return prev;
        const { [gap.slot]: _removed, ...rest } = child;
        const next = { ...prev };
        if (Object.keys(rest).length === 0) delete next[gap.childNavn];
        else next[gap.childNavn] = rest;
        return next;
      });
    },
    [members, externalEscorts]
  );

  const assignExternalAdultToGap = useCallback(
    (gap: AdultEscortGap, voksenNavn: string) => {
      const name = voksenNavn.trim();
      if (!name) return;
      setExternalEscorts((prev) => {
        const next: ExternalEscortDraft = {
          ...prev,
          [gap.childNavn]: { ...(prev[gap.childNavn] || {}), [gap.slot]: name },
        };
        const gaps = listAdultEscortGaps(members, draft, next);
        setEscortQueue(gaps);
        return next;
      });
    },
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

      const minViolations = listWorkshopMinAgeViolations(members, draft);
      if (minViolations.length > 0) {
        const v = minViolations[0];
        setError(
          `${v.navn} kan ikke tilmeldes ${v.workshopName} (${SLOT_LABELS[v.slot]}): minimum ${v.minAge} år.`
        );
        return;
      }

      const rosterForEscort = mergeRosterWithClientMembers(members, members);
      const escortGaps = listAdultEscortGaps(rosterForEscort, draft, externalEscorts);
      if (escortGaps.length > 0) {
        setEscortQueue(escortGaps);
        return;
      }

      setSubmitting(true);
      setError(null);
      setConflicts(null);
      setEscortQueue([]);
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
        if (res.status === 409 && data.code === "WORKSHOP_MIN_AGE") {
          const violations = data.violations as Array<{
            navn: string;
            workshopName: string;
            minAge: number;
            slot: MainWorkshopSlot;
          }>;
          const v = violations?.[0];
          setError(
            v
              ? `${v.navn} kan ikke tilmeldes ${v.workshopName} (${SLOT_LABELS[v.slot]}): minimum ${v.minAge} år.`
              : data.error || "Minimumsalder ikke opfyldt."
          );
          return;
        }
        if (res.status === 409 && data.code === "ADULT_ESCORT_REQUIRED") {
          setEscortQueue(Array.isArray(data.gaps) ? data.gaps : []);
          return;
        }
        if (!res.ok) throw new Error(data.error || "Fejl ved workshop-tilmelding");

        await goToApp(true);
        await fetchOptions();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fejl");
      } finally {
        setSubmitting(false);
      }
    },
    [email, members, draft, externalEscorts, membersPayload, goToApp, fetchOptions]
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
              <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-emerald-900">Tilføjede personer</h2>
                <ul className="divide-y divide-emerald-100 text-sm text-slate-800">
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
              <>
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
              </>
            )}
          </>
        )}

        {step === "workshops" && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-slate-800">Vælg workshops</h1>
            <p className="mb-4 text-sm text-slate-600">
              Vælg én workshop i hvert hold for hver person. Fuldt bookede workshops kan ikke vælges.
              Børn under {YOUNG_CHILD_AGE_MAX_EXCLUSIVE} år skal have en voksen ({ADULT_MIN_AGE}+) på
              samme workshop — eller angive ledsager fra anden familie. Adventurerace: minimum 10 år
              (yngre kan ikke vælges); under 15 år skal have voksen med.
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
                              <option
                                key={opt.name}
                                value={opt.name}
                                disabled={opt.soldOut || isWorkshopBlockedForMember(member, opt.name)}
                              >
                                {optionLabel(opt, member)}
                              </option>
                            ))}
                          </select>
                          {memberNeedsAdultOnWorkshop(member, draft[member.navn]?.[slot] || "") &&
                            draft[member.navn]?.[slot] &&
                            externalEscorts[member.navn]?.[slot] && (
                              <p className="mt-1 text-xs text-slate-500">
                                ({`følges med ${externalEscorts[member.navn]![slot]} fra anden familie`})
                              </p>
                            )}
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

        {escortQueue.length > 0 && (
          <AdultEscortDialog
            gap={escortQueue[0]}
            queueSize={escortQueue.length}
            adults={adultsInFamily}
            onAssignFamily={(adultNavn) => assignFamilyAdultToGap(escortQueue[0], adultNavn)}
            onAssignExternal={(voksenNavn) => assignExternalAdultToGap(escortQueue[0], voksenNavn)}
            onDismiss={() => setEscortQueue([])}
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

function AdultEscortDialog({
  gap,
  queueSize,
  adults,
  onAssignFamily,
  onAssignExternal,
  onDismiss,
}: {
  gap: AdultEscortGap;
  queueSize: number;
  adults: FamilyMember[];
  onAssignFamily: (adultNavn: string) => void;
  onAssignExternal: (voksenNavn: string) => void;
  onDismiss: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "family" | "external">("choose");
  const [selectedAdult, setSelectedAdult] = useState("");
  const [externalName, setExternalName] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-bold text-slate-800">Voksen skal med på workshop</h2>
        <p className="mb-4 text-sm text-slate-600">
          <strong>{gap.childNavn}</strong> (under {gap.adultRequiredBelowAge} år) er tilmeldt{" "}
          <strong>{gap.workshopName}</strong> ({ESCORT_SLOT_LABELS[gap.slot]}). Det kræver en voksen
          på samme workshop.
          {queueSize > 1 && (
            <span className="mt-2 block text-slate-500">({queueSize} mangler stadig løsning)</span>
          )}
        </p>

        {mode === "choose" && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setMode("family")}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white"
            >
              Vælg voksen fra jeres familie
            </button>
            <button
              type="button"
              onClick={() => setMode("external")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Følges med voksen fra anden familie
            </button>
            <button type="button" onClick={onDismiss} className="text-sm text-slate-500 hover:underline">
              Gå tilbage og vælg andre workshops
            </button>
          </div>
        )}

        {mode === "family" && (
          <div className="space-y-3">
            {adults.length === 0 ? (
              <p className="text-sm text-amber-800">
                I har ingen voksne (18+) i familien. Tilføj en voksen under Familie, eller vælg
                ledsager fra anden familie.
              </p>
            ) : (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  Hvilken voksen tilmeldes <strong>{gap.workshopName}</strong>?
                </label>
                <select
                  value={selectedAdult}
                  onChange={(e) => setSelectedAdult(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">— Vælg voksen —</option>
                  {adults.map((a) => (
                    <option key={a.navn} value={a.navn}>
                      {a.navn}
                      {a.alder != null ? ` (${a.alder} år)` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedAdult}
                  onClick={() => onAssignFamily(selectedAdult)}
                  className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Tilmeld voksen på samme workshop
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="text-sm text-slate-500 hover:underline"
            >
              Tilbage
            </button>
          </div>
        )}

        {mode === "external" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Navn på voksen fra anden familie
            </label>
            <input
              type="text"
              value={externalName}
              onChange={(e) => setExternalName(e.target.value)}
              placeholder="Fx Morten"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <button
              type="button"
              disabled={!externalName.trim()}
              onClick={() => onAssignExternal(externalName)}
              className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Gem ledsager
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="text-sm text-slate-500 hover:underline"
            >
              Tilbage
            </button>
          </div>
        )}
      </div>
    </div>
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
