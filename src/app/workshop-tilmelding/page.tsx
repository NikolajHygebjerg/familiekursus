"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { DEFAULT_KURSUS_YEAR } from "@/lib/kursus-year";
import type { WorkshopSlotKey } from "@/lib/airtable";
import {
  type AdultEscortGap,
  type ExternalEscortDraft,
  type SoloWithoutAdultDraft,
  ESCORT_SLOT_LABELS,
  childAllowsExternalFamilyEscort,
  childCanAttendWorkshopWithoutAdult,
  childMustConfirmEscortPerSlot,
  filterAdultsAvailableForEscortSlot,
  findFamilyAdultOnChildSlot,
  getWorkshopAgeRule,
  isWorkshopBlockedForMember,
  listChildEscortDecisionGaps,
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

type Step = "family" | "children" | "adults";

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
  const {
    email,
    familyName,
    setAuth,
    isAdmin,
    adminNavn,
    isAuthReady,
    needsWorkshopRegistration,
  } = useAuth();
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
  const [soloWithoutAdult, setSoloWithoutAdult] = useState<SoloWithoutAdultDraft>({});
  const draftRef = useRef<WorkshopDraft>({});
  const externalEscortsRef = useRef<ExternalEscortDraft>({});
  const soloWithoutAdultRef = useRef<SoloWithoutAdultDraft>({});
  draftRef.current = draft;
  externalEscortsRef.current = externalEscorts;
  soloWithoutAdultRef.current = soloWithoutAdult;

  const goToApp = useCallback(
    async (options?: { syncAuth?: boolean; registrationComplete?: boolean }) => {
      const syncAuth = options?.syncAuth ?? true;
      const registrationComplete = options?.registrationComplete ?? false;

      if (!email) {
        router.replace("/velkommen");
        return;
      }

      if (registrationComplete) {
        setAuth(email, familyName ?? email, false, isAdmin, adminNavn);
      } else if (syncAuth) {
        try {
          const res = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "status", brugernavn: email }),
          });
          const data = res.ok ? await res.json() : null;
          const needsReg = data ? Boolean(data.needsWorkshopRegistration) : true;
          setAuth(
            email,
            data?.familyName ?? familyName ?? email,
            needsReg,
            Boolean(data?.isAdmin),
            data?.adminNavn ?? null
          );
        } catch {
          setAuth(email, familyName || email, registrationComplete ? false : true, isAdmin, adminNavn);
        }
      }

      router.replace("/tilmeldte");
    },
    [email, familyName, setAuth, router, isAdmin, adminNavn]
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
      if (list.length === 0) {
        return;
      }
      setMembers(list);
      syncDraftFromMembers(list);
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
      router.replace("/velkommen");
      return;
    }
    if (isAdmin) {
      router.replace("/program");
      return;
    }
    if (!needsWorkshopRegistration) {
      router.replace("/tilmeldte");
    }
  }, [isAuthReady, email, isAdmin, needsWorkshopRegistration, router]);

  useEffect(() => {
    if (!isAuthReady || !email || isAdmin) return;
    setLoading(true);
    Promise.all([fetchMembers(), fetchOptions()]).finally(() => setLoading(false));
  }, [isAuthReady, email, isAdmin, fetchMembers, fetchOptions]);

  useEffect(() => {
    if ((step !== "children" && step !== "adults") || loading) return;
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
          setStep("children");
          await fetchOptions();
          return;
        }
        if (formEmpty) {
          const list = await fetchMembers();
          if (list.length === 0) {
            setError("Tilføj mindst én person i familien, før I vælger workshops.");
            return;
          }
          setStep("children");
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
          setStep("children");
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

  const childrenInFamily = useMemo(
    () => members.filter((m) => !memberIsAdult(m)),
    [members]
  );

  const adultsInFamily = useMemo(
    () => members.filter((m) => memberIsAdult(m)),
    [members]
  );

  const adultsWithOpenSlots = useMemo(
    () =>
      adultsInFamily.filter((adult) => {
        const d = draft[adult.navn];
        return !d?.workshop1 || !d?.workshop2 || !d?.workshop3 || !d?.workshop4;
      }),
    [adultsInFamily, draft]
  );

  const rosterForEscort = useMemo(
    () => mergeRosterWithClientMembers(members, members),
    [members]
  );

  const setMemberWorkshopChoice = useCallback(
    (memberNavn: string, slot: MainWorkshopSlot, value: string) => {
      setDraft((prev) => ({
        ...prev,
        [memberNavn]: {
          ...(prev[memberNavn] || {
            workshop1: "",
            workshop2: "",
            workshop3: "",
            workshop4: "",
          }),
          [slot]: value,
        },
      }));
      setExternalEscorts((prev) => {
        const child = prev[memberNavn];
        if (!child?.[slot]) return prev;
        const { [slot]: _removed, ...rest } = child;
        const next = { ...prev };
        if (Object.keys(rest).length === 0) delete next[memberNavn];
        else next[memberNavn] = rest;
        return next;
      });
      setSoloWithoutAdult((prev) => {
        const child = prev[memberNavn];
        if (!child?.[slot]) return prev;
        const { [slot]: _removed, ...rest } = child;
        const next = { ...prev };
        if (Object.keys(rest).length === 0) delete next[memberNavn];
        else next[memberNavn] = rest;
        return next;
      });
    },
    []
  );

  const setChildFamilyEscort = useCallback(
    (childNavn: string, slot: MainWorkshopSlot, adultNavn: string, workshopName: string) => {
      if (!adultNavn.trim() || !workshopName.trim()) return;
      setDraft((prev) => ({
        ...prev,
        [adultNavn]: {
          ...(prev[adultNavn] || {
            workshop1: "",
            workshop2: "",
            workshop3: "",
            workshop4: "",
          }),
          [slot]: workshopName,
        },
      }));
      setExternalEscorts((prev) => {
        const child = prev[childNavn];
        if (!child?.[slot]) return prev;
        const { [slot]: _removed, ...rest } = child;
        const next = { ...prev };
        if (Object.keys(rest).length === 0) delete next[childNavn];
        else next[childNavn] = rest;
        return next;
      });
      setSoloWithoutAdult((prev) => {
        const child = prev[childNavn];
        if (!child?.[slot]) return prev;
        const { [slot]: _removed, ...rest } = child;
        const next = { ...prev };
        if (Object.keys(rest).length === 0) delete next[childNavn];
        else next[childNavn] = rest;
        return next;
      });
    },
    []
  );

  const setChildExternalEscort = useCallback(
    (childNavn: string, slot: MainWorkshopSlot, voksenNavn: string) => {
      const name = voksenNavn.trim();
      setExternalEscorts((prev) => {
        if (!name) {
          const child = prev[childNavn];
          if (!child?.[slot]) return prev;
          const { [slot]: _removed, ...rest } = child;
          const next = { ...prev };
          if (Object.keys(rest).length === 0) delete next[childNavn];
          else next[childNavn] = rest;
          return next;
        }
        return {
          ...prev,
          [childNavn]: { ...(prev[childNavn] || {}), [slot]: name },
        };
      });
      if (name) {
        setSoloWithoutAdult((prev) => {
          const child = prev[childNavn];
          if (!child?.[slot]) return prev;
          const { [slot]: _removed, ...rest } = child;
          const next = { ...prev };
          if (Object.keys(rest).length === 0) delete next[childNavn];
          else next[childNavn] = rest;
          return next;
        });
      }
    },
    []
  );

  const setChildSoloWithoutAdult = useCallback(
    (childNavn: string, slot: MainWorkshopSlot, solo: boolean) => {
      setSoloWithoutAdult((prev) => ({
        ...prev,
        [childNavn]: { ...(prev[childNavn] || {}), [slot]: solo },
      }));
      if (solo) {
        setExternalEscorts((prev) => {
          const child = prev[childNavn];
          if (!child?.[slot]) return prev;
          const { [slot]: _removed, ...rest } = child;
          const next = { ...prev };
          if (Object.keys(rest).length === 0) delete next[childNavn];
          else next[childNavn] = rest;
          return next;
        });
      }
    },
    []
  );

  const adultNeedsMoreWorkshopChoices = useCallback(
    (liveDraft: WorkshopDraft) =>
      adultsInFamily.some((adult) => {
        const d = liveDraft[adult.navn];
        return !d?.workshop1 || !d?.workshop2 || !d?.workshop3 || !d?.workshop4;
      }),
    [adultsInFamily]
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
        const gaps = listChildEscortDecisionGaps(
          rosterForEscort,
          next,
          externalEscortsRef.current,
          soloWithoutAdultRef.current
        );
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
    [rosterForEscort, externalEscorts]
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
        const gaps = listChildEscortDecisionGaps(
          rosterForEscort,
          draftRef.current,
          next,
          soloWithoutAdultRef.current
        );
        setEscortQueue(gaps);
        return next;
      });
    },
    [rosterForEscort]
  );

  const assignSoloToGap = useCallback(
    (gap: AdultEscortGap) => {
      setChildSoloWithoutAdult(gap.childNavn, gap.slot, true);
      const gaps = listChildEscortDecisionGaps(
        rosterForEscort,
        draftRef.current,
        externalEscortsRef.current,
        {
          ...soloWithoutAdultRef.current,
          [gap.childNavn]: {
            ...(soloWithoutAdultRef.current[gap.childNavn] || {}),
            [gap.slot]: true,
          },
        }
      );
      setEscortQueue(gaps);
    },
    [rosterForEscort, setChildSoloWithoutAdult]
  );

  const submitWorkshops = useCallback(
    async (acceptPartial = false, partialChoices?: Record<string, string[]>) => {
      if (!email) return;
      const liveDraft = draftRef.current;
      const incomplete = members.some((m) => {
        const d = liveDraft[m.navn];
        return !d?.workshop1 || !d?.workshop2 || !d?.workshop3 || !d?.workshop4;
      });
      if (incomplete) {
        setError("Vælg workshop 1–4 for hver person i familien");
        return;
      }

      const currentDraft = draftRef.current;
      const currentEscorts = externalEscortsRef.current;

      const minViolations = listWorkshopMinAgeViolations(members, currentDraft);
      if (minViolations.length > 0) {
        const v = minViolations[0];
        setError(
          `${v.navn} kan ikke tilmeldes ${v.workshopName} (${SLOT_LABELS[v.slot]}): minimum ${v.minAge} år.`
        );
        return;
      }

      const escortGaps = listChildEscortDecisionGaps(
        rosterForEscort,
        currentDraft,
        currentEscorts,
        soloWithoutAdultRef.current
      );
      if (escortGaps.length > 0) {
        setEscortQueue(escortGaps);
        return;
      }

      setSubmitting(true);
      setError(null);
      setConflicts(null);
      setEscortQueue([]);
      try {
        const currentDraft = draftRef.current;
        const currentEscorts = externalEscortsRef.current;
        const membersBody = members.map((m) => ({
          navn: m.navn,
          alder: m.alder,
          type: m.type ?? null,
          workshop1: currentDraft[m.navn]?.workshop1 || "",
          workshop2: currentDraft[m.navn]?.workshop2 || "",
          workshop3: currentDraft[m.navn]?.workshop3 || "",
          workshop4: currentDraft[m.navn]?.workshop4 || "",
          ledsager1: currentEscorts[m.navn]?.workshop1 || "",
          ledsager2: currentEscorts[m.navn]?.workshop2 || "",
          ledsager3: currentEscorts[m.navn]?.workshop3 || "",
          ledsager4: currentEscorts[m.navn]?.workshop4 || "",
        }));

        const res = await fetch("/api/workshop-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "workshops",
            email,
            members: membersBody,
            acceptPartial,
            partialChoices,
          }),
        });
        const data = await res.json();
        if (res.status === 403 && data.code === "ALREADY_REGISTERED") {
          await goToApp({ registrationComplete: true, syncAuth: true });
          return;
        }
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

        const registrationComplete =
          data.registrationComplete === true &&
          typeof data.familyMemberCount === "number" &&
          data.familyMemberCount > 0;
        if (!registrationComplete) {
          const year =
            typeof data.kursusYear === "number" ? data.kursusYear : DEFAULT_KURSUS_YEAR;
          setError(
            `Workshops kunne ikke bekræftes i databasen (kursusår ${year}). ` +
              (data.familyMemberCount === 0
                ? "Ingen familiemedlemmer fundet for dit login — tjek at Vercel har samme Supabase-forbindelse som udvikling (se .env.example), og at KURSUS_YEAR=2027 er sat."
                : "Tjek at alle i familien har valg på alle fire hold, og prøv igen.")
          );
          return;
        }

        await goToApp({ registrationComplete: true, syncAuth: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fejl");
      } finally {
        setSubmitting(false);
      }
    },
    [email, members, rosterForEscort, goToApp]
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

  const continueFromChildrenToAdults = useCallback(() => {
    const liveDraft = draftRef.current;
    const kids = members.filter((m) => !memberIsAdult(m));

    if (kids.length === 0) {
      setError(null);
      if (adultNeedsMoreWorkshopChoices(liveDraft)) {
        setStep("adults");
      } else {
        void submitWorkshops(false);
      }
      return;
    }

    for (const child of kids) {
      const d = liveDraft[child.navn];
      if (!d?.workshop1 || !d?.workshop2 || !d?.workshop3 || !d?.workshop4) {
        setError(`Vælg workshop 1–4 for ${child.navn}`);
        return;
      }
    }

    const minViolations = listWorkshopMinAgeViolations(members, liveDraft);
    if (minViolations.length > 0) {
      const v = minViolations[0];
      setError(
        `${v.navn} kan ikke tilmeldes ${v.workshopName} (${SLOT_LABELS[v.slot]}): minimum ${v.minAge} år.`
      );
      return;
    }

    const escortGaps = listChildEscortDecisionGaps(
      rosterForEscort,
      liveDraft,
      externalEscortsRef.current,
      soloWithoutAdultRef.current
    );
    if (escortGaps.length > 0) {
      const g = escortGaps[0];
      setError(
        `${g.childNavn} på ${SLOT_LABELS[g.slot]} (${g.workshopName}): vælg en voksen fra familien, eller «Deltager uden voksen» hvis barnet er gammel nok. Ledsager fra anden familie gælder kun under 10 år.`
      );
      return;
    }

    setError(null);
    if (adultNeedsMoreWorkshopChoices(liveDraft)) {
      setStep("adults");
    } else {
      void submitWorkshops(false);
    }
  }, [members, rosterForEscort, adultNeedsMoreWorkshopChoices, submitWorkshops]);

  const childrenStepPrimaryLabel = useMemo(() => {
    if (submitting) return "Gemmer...";
    return adultNeedsMoreWorkshopChoices(draft)
      ? "Fortsæt til voksnes workshops"
      : "Bekræft workshopvalg";
  }, [draft, adultNeedsMoreWorkshopChoices, submitting]);

  if (!email) return null;

  return (
    <main className="min-h-screen p-6 pb-24">
      <div className="mx-auto max-w-2xl">
        {step === "family" && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-slate-800">Familie</h1>
            <p className="mb-6 text-sm text-slate-600">
              Indtast fornavn og alder på alle familiemedlemmer du vil vælge workshop for
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
                        Vælg workshops
                      </button>
                    </div>
                  </form>
              </>
            )}
          </>
        )}

        {step === "children" && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-slate-800">Børnenes workshops</h1>
            <p className="mb-4 text-sm text-slate-600">
              Vælg workshop for hvert barn. Er barnet under 10 år skal der vælges en voksen der deltager sammen med
              barnet. Fra 10 år kan man vælge at barnet deltager uden voksen (dog kræver adventurerace at man er minimum
              10 år og sammen med en voksen hvis man er 10-15 år).
            </p>

            {loading ? (
              <p className="text-slate-500">Henter workshops...</p>
            ) : members.length === 0 ? (
              <p className="text-slate-600">
                Ingen familiemedlemmer fundet. Gå tilbage til Familie og tilføj dem først.
              </p>
            ) : childrenInFamily.length === 0 ? (
              <div className="space-y-4 rounded-xl bg-white p-6 shadow-lg">
                <p className="text-slate-600">
                  Der er ingen børn i listen. Tilføj børn under Familie, eller fortsæt til voksnes
                  workshops.
                </p>
                {error && <ErrorBox message={error} />}
                <button
                  type="button"
                  onClick={() => continueFromChildrenToAdults()}
                  disabled={submitting}
                  className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {childrenStepPrimaryLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("family")}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  Tilbage til familie
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {childrenInFamily.map((child) => (
                  <ChildWorkshopCard
                    key={child.navn}
                    child={child}
                    draft={draft}
                    options={options}
                    soloWithoutAdult={soloWithoutAdult}
                    externalEscorts={externalEscorts}
                    adults={adultsInFamily}
                    onWorkshopChange={(slot, value) => setMemberWorkshopChoice(child.navn, slot, value)}
                    onFamilyEscort={(slot, adultNavn, workshopName) =>
                      setChildFamilyEscort(child.navn, slot, adultNavn, workshopName)
                    }
                    onExternalEscort={(slot, name) => setChildExternalEscort(child.navn, slot, name)}
                    onSoloChange={(slot, solo) => setChildSoloWithoutAdult(child.navn, slot, solo)}
                  />
                ))}

                {error && <ErrorBox message={error} />}

                <button
                  type="button"
                  onClick={() => continueFromChildrenToAdults()}
                  disabled={submitting}
                  className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {childrenStepPrimaryLabel}
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

        {step === "adults" && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-slate-800">Voksnes workshops</h1>
            <p className="mb-4 text-sm text-slate-600">
              Vælg workshop i de hold, hvor voksenen ikke allerede er tilmeldt for at følge et barn. Hold
              udfyldt via ledsager er markeret som fastlagt.
            </p>

            {loading ? (
              <p className="text-slate-500">Henter...</p>
            ) : adultsInFamily.length === 0 ? (
              <p className="text-slate-600">Ingen voksne i familien.</p>
            ) : (
              <div className="space-y-6">
                {adultsWithOpenSlots.length === 0 ? (
                  <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
                    Alle voksne har valg på alle fire hold (ofte fordi de følger barnene). Bekræft nedenfor.
                  </p>
                ) : (
                  adultsWithOpenSlots.map((adult) => (
                    <section
                      key={adult.navn}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <h2 className="mb-3 font-semibold text-slate-800">
                        {adult.navn}
                        {adult.alder != null && (
                          <span className="ml-2 text-sm font-normal text-slate-500">
                            {adult.alder} år
                          </span>
                        )}
                      </h2>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {SLOT_KEYS.map((slot) => {
                          const chosen = draft[adult.navn]?.[slot] || "";
                          const locked = Boolean(chosen);
                          return (
                            <label key={slot} className="block text-sm">
                              <span className="mb-1 block font-medium text-slate-700">
                                {SLOT_LABELS[slot]}
                              </span>
                              {locked ? (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-slate-800">
                                  {chosen}
                                  <p className="mt-1 text-xs text-emerald-800">Følger med barn</p>
                                </div>
                              ) : (
                                <select
                                  value=""
                                  onChange={(e) =>
                                    setMemberWorkshopChoice(adult.navn, slot, e.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
                                >
                                  <option value="">— Vælg —</option>
                                  {(options[slot] || []).map((opt) => (
                                    <option
                                      key={opt.name}
                                      value={opt.name}
                                      disabled={
                                        opt.soldOut || isWorkshopBlockedForMember(adult, opt.name)
                                      }
                                    >
                                      {optionLabel(opt, adult)}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}

                {error && <ErrorBox message={error} />}

                <button
                  type="button"
                  onClick={() => void submitWorkshops(false)}
                  disabled={submitting}
                  className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {submitting ? "Gemmer..." : "Bekræft workshopvalg"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("children");
                  }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  Tilbage til børn
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
            key={`${escortQueue[0].childNavn}:${escortQueue[0].slot}:${escortQueue[0].workshopName}`}
            gap={escortQueue[0]}
            queueSize={escortQueue.length}
            child={members.find((m) => m.navn === escortQueue[0].childNavn) ?? null}
            adults={
              filterAdultsAvailableForEscortSlot(
                adultsInFamily,
                draft,
                escortQueue[0].slot,
                escortQueue[0].workshopName
              ) as FamilyMember[]
            }
            onAssignFamily={(adultNavn) => assignFamilyAdultToGap(escortQueue[0], adultNavn)}
            onAssignExternal={(voksenNavn) => assignExternalAdultToGap(escortQueue[0], voksenNavn)}
            onAssignSolo={() => assignSoloToGap(escortQueue[0])}
            onDismiss={() => setEscortQueue([])}
          />
        )}
      </div>
    </main>
  );
}

const EXTERNAL_FAMILY_ESCORT_VALUE = "__external_family_escort__";

function ChildWorkshopCard({
  child,
  draft,
  options,
  soloWithoutAdult,
  externalEscorts,
  adults,
  onWorkshopChange,
  onFamilyEscort,
  onExternalEscort,
  onSoloChange,
}: {
  child: FamilyMember;
  draft: WorkshopDraft;
  options: Record<WorkshopSlotKey, WorkshopOptionDetail[]>;
  soloWithoutAdult: SoloWithoutAdultDraft;
  externalEscorts: ExternalEscortDraft;
  adults: FamilyMember[];
  onWorkshopChange: (slot: MainWorkshopSlot, value: string) => void;
  onFamilyEscort: (slot: MainWorkshopSlot, adultNavn: string, workshopName: string) => void;
  onExternalEscort: (slot: MainWorkshopSlot, name: string) => void;
  onSoloChange: (slot: MainWorkshopSlot, solo: boolean) => void;
}) {
  const [externalEscortActive, setExternalEscortActive] = useState<
    Partial<Record<MainWorkshopSlot, boolean>>
  >({});

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold text-slate-800">
        {child.navn}
        {child.alder != null && (
          <span className="ml-2 text-sm font-normal text-slate-500">{child.alder} år</span>
        )}
      </h2>
      <div className="space-y-4">
        {SLOT_KEYS.map((slot) => {
          const workshopName = draft[child.navn]?.[slot] || "";
          const needsAdult = memberNeedsAdultOnWorkshop(child, workshopName);
          const showEscort =
            Boolean(workshopName) &&
            (needsAdult || childMustConfirmEscortPerSlot(child));
          const canSolo = childCanAttendWorkshopWithoutAdult(child, workshopName);
          const allowExternal = childAllowsExternalFamilyEscort(child);
          const solo = Boolean(soloWithoutAdult[child.navn]?.[slot]);
          const externalName = externalEscorts[child.navn]?.[slot] || "";
          const familyEscort =
            workshopName && !externalName
              ? findFamilyAdultOnChildSlot(adults, draft, slot, workshopName)
              : null;
          const escortAdults =
            workshopName.length > 0
              ? filterAdultsAvailableForEscortSlot(adults, draft, slot, workshopName)
              : adults;

          return (
            <div
              key={slot}
              className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm"
            >
              <label className="mb-2 block font-medium text-slate-700">{SLOT_LABELS[slot]}</label>
              <select
                value={workshopName}
                onChange={(e) => {
                  setExternalEscortActive((prev) => {
                    const next = { ...prev };
                    delete next[slot];
                    return next;
                  });
                  onWorkshopChange(slot, e.target.value);
                }}
                className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
              >
                <option value="">— Vælg workshop —</option>
                {(options[slot] || []).map((opt) => (
                  <option
                    key={opt.name}
                    value={opt.name}
                    disabled={opt.soldOut || isWorkshopBlockedForMember(child, opt.name)}
                  >
                    {optionLabel(opt, child)}
                  </option>
                ))}
              </select>

              {showEscort && (
                <div className="space-y-2 border-t border-slate-200 pt-2">
                  {canSolo && (
                    <label className="flex cursor-pointer items-center gap-2 text-slate-700">
                      <input
                        type="checkbox"
                        checked={solo}
                        onChange={(e) => onSoloChange(slot, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Deltager uden voksen
                    </label>
                  )}

                  {!solo && (
                    <label className="block text-slate-700">
                      <span className="mb-1 block text-xs font-medium">
                        Hvilken voksen følger med på {SLOT_LABELS[slot].toLowerCase()}?
                      </span>
                      <select
                        value={
                          externalName || externalEscortActive[slot]
                            ? EXTERNAL_FAMILY_ESCORT_VALUE
                            : familyEscort || ""
                        }
                        onChange={(e) => {
                          const choice = e.target.value;
                          if (choice === EXTERNAL_FAMILY_ESCORT_VALUE) {
                            setExternalEscortActive((prev) => ({ ...prev, [slot]: true }));
                            if (!externalName) onExternalEscort(slot, "");
                          } else if (choice) {
                            setExternalEscortActive((prev) => ({ ...prev, [slot]: false }));
                            onFamilyEscort(slot, choice, workshopName);
                          } else {
                            setExternalEscortActive((prev) => ({ ...prev, [slot]: false }));
                            onExternalEscort(slot, "");
                          }
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                      >
                        <option value="">— Vælg voksen —</option>
                        {escortAdults.map((a) => (
                          <option key={a.navn} value={a.navn}>
                            {a.navn}
                            {a.alder != null ? ` (${a.alder} år)` : ""}
                          </option>
                        ))}
                        {allowExternal && (
                          <option value={EXTERNAL_FAMILY_ESCORT_VALUE}>
                            Vælg en voksen fra en anden familie (fornavn)
                          </option>
                        )}
                      </select>
                      {allowExternal && (externalName || externalEscortActive[slot]) && (
                        <input
                          type="text"
                          value={externalName}
                          onChange={(e) => onExternalEscort(slot, e.target.value)}
                          placeholder="Fornavn på voksen, fx Morten"
                          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
                        />
                      )}
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
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
  child,
  adults,
  onAssignFamily,
  onAssignExternal,
  onAssignSolo,
  onDismiss,
}: {
  gap: AdultEscortGap;
  queueSize: number;
  child: FamilyMember | null;
  adults: FamilyMember[];
  onAssignFamily: (adultNavn: string) => void;
  onAssignExternal: (voksenNavn: string) => void;
  onAssignSolo: () => void;
  onDismiss: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "family" | "external">("choose");
  const [selectedAdult, setSelectedAdult] = useState("");
  const [externalName, setExternalName] = useState("");
  const allowExternal = child ? childAllowsExternalFamilyEscort(child) : false;
  const canSolo =
    child && gap.workshopName
      ? childCanAttendWorkshopWithoutAdult(child, gap.workshopName)
      : false;

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
            {allowExternal && (
              <button
                type="button"
                onClick={() => setMode("external")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Følges med voksen fra anden familie
              </button>
            )}
            {canSolo && (
              <button
                type="button"
                onClick={onAssignSolo}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900"
              >
                Deltager uden voksen
              </button>
            )}
            <button type="button" onClick={onDismiss} className="text-sm text-slate-500 hover:underline">
              Gå tilbage og vælg andre workshops
            </button>
          </div>
        )}

        {mode === "family" && (
          <div className="space-y-3">
            {adults.length === 0 ? (
              <p className="text-sm text-amber-800">
                I har ingen voksne (18+) i familien. Tilføj en voksen under Familie
                {allowExternal ? ", eller vælg ledsager fra anden familie." : canSolo ? ", eller vælg deltager uden voksen." : "."}
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
