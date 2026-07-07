"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/context/FamilyContext";
import { useAuth } from "@/context/AuthContext";
import { UGEPROGRAM, appendVoksencafeProgram, type ProgramItem } from "@/data/program";
import {
  buildProgramItemKey,
  getVisibleAnsvarLines,
  type AdminUserOption,
  type ProgramAnsvarDraft,
  type ProgramAnsvarlig,
} from "@/lib/program-ansvar";
import { appendLokationToText, lookupWorkshopLokation } from "@/lib/program-display";

const WORKSHOPOVERSIGT_SLOTS = ["aftengrupper", "gyserløb", "sheltertur"] as const;

interface ProgramItemWithWorkshops extends Omit<ProgramItem, "workshopSlot"> {
  workshops?: string[];
  lokation?: string;
  workshopSlot?: "workshop1" | "workshop2" | "workshop3" | "workshop4" | "voksen" | "aftengrupper" | "gyserløb" | "sheltertur";
  aldersgrupperItem?: boolean;
}

interface DagProgramWithWorkshops {
  dag: string;
  dato?: string;
  program: ProgramItemWithWorkshops[];
}

interface FamilyMember {
  navn: string;
  workshop1: string | null;
  workshop2: string | null;
  workshop3: string | null;
  workshop4: string | null;
  voksen: string | null;
  aftengrupper: string | null;
}

function isDetStoreFamilieloeb(titel: string): boolean {
  const t = titel.toLowerCase();
  return t.includes("familieløb") || t.includes("familieloeb");
}

function extractHoldNumber(holdnavn: string): string {
  const match = holdnavn.match(/\d+/);
  return match ? match[0] : holdnavn;
}

function formatTid(tid: string): string {
  return tid.replace(/:/g, ".");
}

function stripTimeFromTitel(titel: string): string {
  const timePattern = /\d{1,2}[.:]\d{2}(?:[-\s]\d{1,2}[.:]\d{2})?[.:\s–-]*\s*/gi;
  let result = titel.trim();
  let prev: string;
  do {
    prev = result;
    result = result.replace(timePattern, "").trim();
  } while (result !== prev);
  return result;
}

function LokationSuffix({ lokation }: { lokation: string }) {
  return <span className="font-normal text-slate-500"> ({lokation})</span>;
}

function NameWithLokation({
  name,
  lokation,
  className,
}: {
  name: string;
  lokation?: string | null;
  className?: string;
}) {
  const location = lokation?.trim();
  return (
    <span className={className}>
      {name}
      {location ? <LokationSuffix lokation={location} /> : null}
    </span>
  );
}

function ProgramListItem({
  item,
  ansvarLines,
  canManageAnsvarlige,
  onManageAnsvarlige,
  workshopLocations,
}: {
  item: ProgramItemWithWorkshops;
  ansvarLines?: string[];
  canManageAnsvarlige?: boolean;
  onManageAnsvarlige?: () => void;
  workshopLocations: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasWorkshops = item.workshops && item.workshops.length > 0;
  const isExpandable = item.workshopSlot && hasWorkshops;
  const linksToTilmeld =
    item.workshopSlot === "aftengrupper" ||
    item.workshopSlot === "sheltertur" ||
    item.workshopSlot === "gyserløb";
  const showParticipants = !!item.beskrivelse;

  const ArrowIcon = () => (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  const displayTitel = item.tid ? stripTimeFromTitel(item.titel) : item.titel;

  const titledContent = (
    <NameWithLokation
      name={displayTitel}
      lokation={item.lokation}
      className="font-medium text-slate-800"
    />
  );

  const titleContent = linksToTilmeld ? (
    <Link
      href="/tilmeld"
      className="font-medium text-amber-700 hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      <NameWithLokation name={displayTitel} lokation={item.lokation} />
    </Link>
  ) : isExpandable ? (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setExpanded(!expanded);
      }}
      className="inline-flex items-center gap-1.5 text-left"
    >
      {titledContent}
      <span className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}>
        <ArrowIcon />
      </span>
    </button>
  ) : (
    titledContent
  );

  const content = (
    <>
      <div className="flex gap-4">
        {item.tid && (
          <span className="min-w-[5.5rem] shrink-0 whitespace-nowrap text-sm font-medium text-slate-500">
            {formatTid(item.tid)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">{titleContent}</div>
            {canManageAnsvarlige && (
              <span className="shrink-0 text-xs font-medium text-amber-700">Ansvarlige</span>
            )}
          </div>
          {ansvarLines && ansvarLines.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {ansvarLines.map((line, index) => (
                <p key={`${line}-${index}`} className="text-sm font-medium text-amber-900">
                  {line}
                </p>
              ))}
            </div>
          )}
          {showParticipants && (
            <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {item.beskrivelse}
            </pre>
          )}
          {expanded && hasWorkshops && (
            <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
              {item.workshops!.map((ws, i) => (
                <li key={i} className="text-sm text-slate-600">
                  •{" "}
                  <NameWithLokation
                    name={ws}
                    lokation={lookupWorkshopLokation(ws, workshopLocations)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );

  if (canManageAnsvarlige && onManageAnsvarlige) {
    return (
      <button
        type="button"
        onClick={onManageAnsvarlige}
        className="w-full rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-amber-200 hover:bg-amber-50/70"
      >
        {content}
      </button>
    );
  }

  return <div className="px-2 py-2">{content}</div>;
}

function emptyAnsvarDraft(): ProgramAnsvarDraft {
  return { adminEmail: "", adminNavn: "", note: "" };
}

export default function ProgramPage() {
  const { selectedFamily, isKursusleder } = useFamily();
  const { email, isAdmin, adminNavn } = useAuth();
  const [view, setView] = useState<"uge" | "dag">("uge");
  const [selectedDag, setSelectedDag] = useState(0);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [programData, setProgramData] = useState<DagProgramWithWorkshops[] | null>(null);
  const [workshopLocations, setWorkshopLocations] = useState<Record<string, string>>({});
  const [programLoading, setProgramLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [familieloebInfo, setFamilieloebInfo] = useState<{ holdnavn: string } | null>(null);
  const [aldersgruppeBeskrivelse, setAldersgruppeBeskrivelse] = useState<string | null>(null);
  const [ansvarByKey, setAnsvarByKey] = useState<Record<string, ProgramAnsvarlig[]>>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUserOption[]>([]);
  const [selectedAnsvarItem, setSelectedAnsvarItem] = useState<{
    dag: string;
    item: ProgramItemWithWorkshops;
  } | null>(null);
  const [ansvarDraft, setAnsvarDraft] = useState<ProgramAnsvarDraft[]>([emptyAnsvarDraft()]);
  const [ansvarSaving, setAnsvarSaving] = useState(false);
  const [ansvarError, setAnsvarError] = useState<string | null>(null);

  const familyToLoad = isKursusleder ? null : (selectedFamily && selectedFamily.includes("@") ? selectedFamily : null);

  const loadAnsvarlige = useCallback(() => {
    if (!email || !isAdmin) return;
    fetch(`/api/program/ansvarlige?email=${encodeURIComponent(email)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.byKey) return;
        setAnsvarByKey(data.byKey);
        setIsSuperAdmin(Boolean(data.isSuperAdmin));
        setAdminUsers(Array.isArray(data.adminUsers) ? data.adminUsers : []);
      })
      .catch(() => {
        setAnsvarByKey({});
        setIsSuperAdmin(false);
        setAdminUsers([]);
      });
  }, [email, isAdmin]);

  useEffect(() => {
    loadAnsvarlige();
  }, [loadAnsvarlige]);

  useEffect(() => {
    setProgramLoading(true);
    fetch("/api/program")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) {
          setProgramData(data.length > 0 ? data : null);
          setWorkshopLocations({});
          return;
        }
        const program = Array.isArray(data?.program) ? data.program : [];
        setProgramData(program.length > 0 ? program : null);
        setWorkshopLocations(
          data?.workshopLocations && typeof data.workshopLocations === "object"
            ? data.workshopLocations
            : {}
        );
      })
      .catch(() => {
        setProgramData(null);
        setWorkshopLocations({});
      })
      .finally(() => setProgramLoading(false));
  }, []);

  useEffect(() => {
    if (familyToLoad && familyToLoad.includes("@")) {
      setMembersLoading(true);
      fetch(`/api/families/email?email=${encodeURIComponent(familyToLoad)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then(setMembers)
        .catch(() => setMembers([]))
        .finally(() => setMembersLoading(false));
    } else {
      setMembers([]);
    }
  }, [familyToLoad]);

  useEffect(() => {
    if (!familyToLoad || !familyToLoad.includes("@")) {
      setFamilieloebInfo(null);
      return;
    }
    fetch(`/api/familieloeb?email=${encodeURIComponent(familyToLoad)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.holdnavn) {
          setFamilieloebInfo({ holdnavn: data.holdnavn });
        } else {
          setFamilieloebInfo(null);
        }
      })
      .catch(() => setFamilieloebInfo(null));
  }, [familyToLoad]);

  useEffect(() => {
    if (!familyToLoad || !familyToLoad.includes("@")) {
      setAldersgruppeBeskrivelse(null);
      return;
    }
    fetch(`/api/aldersgrupper?email=${encodeURIComponent(familyToLoad)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAldersgruppeBeskrivelse(data?.beskrivelse || null))
      .catch(() => setAldersgruppeBeskrivelse(null));
  }, [familyToLoad]);

  const baseProgram = appendVoksencafeProgram(programData ?? UGEPROGRAM);

  const formatWorkshopLabel = useCallback(
    (workshopName: string) =>
      appendLokationToText(workshopName, lookupWorkshopLokation(workshopName, workshopLocations)),
    [workshopLocations]
  );

  const dagMedFamilieWorkshops = useMemo((): DagProgramWithWorkshops[] => {
    return baseProgram.map((dag) => ({
      ...dag,
      program: dag.program.map((item) => {
        if (item.aldersgrupperItem) {
          if (familyToLoad && aldersgruppeBeskrivelse) {
            return { ...item, beskrivelse: aldersgruppeBeskrivelse };
          }
          return item;
        }

        if (isDetStoreFamilieloeb(item.titel) && familieloebInfo?.holdnavn && familyToLoad) {
          return {
            ...item,
            beskrivelse: `Jeres familie er på hold nummer ${extractHoldNumber(familieloebInfo.holdnavn)}`,
          };
        }

        const slotKey = item.workshopSlot;
        if (!slotKey) return item;

        if (slotKey === "sheltertur" || slotKey === "gyserløb") {
          return {
            ...item,
            workshops: undefined,
            beskrivelse: undefined,
          };
        }

        if (isKursusleder && slotKey === "aftengrupper") {
          return item;
        }

        if (WORKSHOPOVERSIGT_SLOTS.includes(slotKey as (typeof WORKSHOPOVERSIGT_SLOTS)[number])) {
          if (slotKey === "aftengrupper") {
            if (members.length === 0) return item;
            const grouped = new Map<string, string[]>();
            for (const m of members) {
              if (m.aftengrupper) {
                const list = grouped.get(m.aftengrupper) || [];
                list.push(m.navn);
                grouped.set(m.aftengrupper, list);
              }
            }
            const workshopLines = Array.from(grouped.entries())
              .map(([gruppe, navne]) => `${gruppe}: ${navne.join(", ")}`)
              .join("\n");
            const familyAftengrupper = Array.from(grouped.keys());
            return {
              ...item,
              workshops: familyAftengrupper.length > 0 ? familyAftengrupper : undefined,
              beskrivelse: workshopLines || undefined,
            };
          }
        }

        if (members.length === 0) return item;

        const grouped = new Map<string, string[]>();
        for (const m of members) {
          const ws = m[slotKey as keyof FamilyMember];
          if (typeof ws === "string" && ws) {
            const list = grouped.get(ws) || [];
            list.push(m.navn);
            grouped.set(ws, list);
          }
        }

        const workshopLines = Array.from(grouped.entries())
          .map(([ws, navne]) => `${formatWorkshopLabel(ws)}: ${navne.join(", ")}`)
          .join("\n");

        const familyWorkshopNames = Array.from(grouped.keys());

        return {
          ...item,
          workshops: familyWorkshopNames.length > 0 ? familyWorkshopNames : undefined,
          beskrivelse: workshopLines || undefined,
        };
      }),
    }));
  }, [members, baseProgram, isKursusleder, familieloebInfo, familyToLoad, aldersgruppeBeskrivelse, formatWorkshopLabel]);

  const dagProgram = dagMedFamilieWorkshops[selectedDag] ?? dagMedFamilieWorkshops[0];
  const loading = programLoading || membersLoading;

  const getAnsvarLines = useCallback(
    (dag: string, item: ProgramItemWithWorkshops) => {
      if (!isAdmin) return [];
      const key = buildProgramItemKey(dag, item);
      const assignments = ansvarByKey[key] || [];
      return getVisibleAnsvarLines(assignments, {
        isSuperAdmin,
        email,
        adminNavn,
      });
    },
    [ansvarByKey, isAdmin, isSuperAdmin, email, adminNavn]
  );

  function openAnsvarEditor(dag: string, item: ProgramItemWithWorkshops) {
    const key = buildProgramItemKey(dag, item);
    const existing = ansvarByKey[key] || [];
    setSelectedAnsvarItem({ dag, item });
    setAnsvarError(null);
    setAnsvarDraft(
      existing.length > 0
        ? existing.map((entry) => ({
            adminEmail: entry.adminEmail,
            adminNavn: entry.adminNavn,
            note: entry.note,
          }))
        : [emptyAnsvarDraft()]
    );
  }

  async function saveAnsvarlige() {
    if (!email || !selectedAnsvarItem) return;
    setAnsvarSaving(true);
    setAnsvarError(null);
    try {
      const res = await fetch("/api/program/ansvarlige", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          dag: selectedAnsvarItem.dag,
          tid: selectedAnsvarItem.item.tid,
          titel: selectedAnsvarItem.item.titel,
          ansvarlige: ansvarDraft.filter((entry) => entry.adminEmail.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSelectedAnsvarItem(null);
      loadAnsvarlige();
    } catch (err) {
      setAnsvarError(err instanceof Error ? err.message : "Kunne ikke gemme ansvarlige");
    } finally {
      setAnsvarSaving(false);
    }
  }

  function renderProgramItem(dag: string, item: ProgramItemWithWorkshops, index: number) {
    return (
      <li key={`${dag}-${index}-${item.tid || ""}-${item.titel}`}>
        <ProgramListItem
          item={item}
          ansvarLines={getAnsvarLines(dag, item)}
          canManageAnsvarlige={isSuperAdmin}
          onManageAnsvarlige={isSuperAdmin ? () => openAnsvarEditor(dag, item) : undefined}
          workshopLocations={workshopLocations}
        />
      </li>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Program</h1>
          <p className="mt-1 text-slate-600">
            {view === "uge"
              ? "Oversigt over ugeprogrammet"
              : isKursusleder
                ? "Vælg en dag for at se programmet"
                : `Dagens program for ${email || "din familie"}`}
          </p>
          {isSuperAdmin && (
            <p className="mt-2 text-sm text-amber-700">
              Tryk på et programpunkt for at vælge ansvarlige og noter.
            </p>
          )}
        </header>

        <div className="mb-8 flex gap-2">
          <button
            onClick={() => setView("uge")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              view === "uge" ? "bg-amber-500 text-white" : "bg-white text-slate-600 shadow-sm hover:bg-slate-100"
            }`}
          >
            Ugeprogram
          </button>
          <button
            onClick={() => setView("dag")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              view === "dag" ? "bg-amber-500 text-white" : "bg-white text-slate-600 shadow-sm hover:bg-slate-100"
            }`}
          >
            Dagens program
          </button>
        </div>

        {programLoading ? (
          <div className="flex items-center gap-2 rounded-xl bg-white p-8 shadow-lg text-slate-500">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Henter program fra Airtable...
          </div>
        ) : view === "uge" ? (
          <section className="space-y-6">
            {dagMedFamilieWorkshops.map((dag) => (
              <div key={dag.dag} className="rounded-xl bg-white p-6 shadow-lg">
                <h2 className="mb-4 text-xl font-semibold text-slate-800">
                  {dag.dag} {dag.dato && `– ${dag.dato}`}
                </h2>
                <ul className="space-y-1">
                  {dag.program.map((item, i) => renderProgramItem(dag.dag, item, i))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        {view === "dag" && !programLoading && (
          <section className="rounded-xl bg-white p-6 shadow-lg">
            {!familyToLoad && !isKursusleder && (
              <p className="mb-4 text-slate-500">
                Log ind for at se jeres workshop-tilmeldinger.
              </p>
            )}
            {loading && familyToLoad ? (
              <div className="flex items-center gap-2 text-slate-500">
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Henter program...
              </div>
            ) : dagProgram ? (
              <>
                <div className="mb-6 flex flex-wrap gap-2">
                  {dagMedFamilieWorkshops.map((dag, idx) => (
                    <button
                      key={dag.dag}
                      onClick={() => setSelectedDag(idx)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                        selectedDag === idx
                          ? "bg-amber-500 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {dag.dag}
                    </button>
                  ))}
                </div>
                <h2 className="mb-4 text-xl font-semibold text-slate-800">
                  {dagProgram.dag} {dagProgram.dato && `– ${dagProgram.dato}`}
                </h2>
                <ul className="space-y-1">
                  {dagProgram.program.map((item, i) => renderProgramItem(dagProgram.dag, item, i))}
                </ul>
              </>
            ) : (
              <p className="text-slate-500">Ingen programdata tilgængelig.</p>
            )}
          </section>
        )}
      </div>

      {selectedAnsvarItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Ansvarlige</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedAnsvarItem.dag}
                  {selectedAnsvarItem.item.tid ? ` · ${formatTid(selectedAnsvarItem.item.tid)}` : ""} ·{" "}
                  {stripTimeFromTitel(selectedAnsvarItem.item.titel)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnsvarItem(null)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Luk
              </button>
            </div>

            <div className="space-y-4">
              {ansvarDraft.map((entry, index) => (
                <div key={index} className="rounded-xl border border-slate-200 p-3">
                  <label className="block text-xs font-medium text-slate-600">Ansvarlig</label>
                  <select
                    value={entry.adminEmail}
                    onChange={(event) => {
                      const adminEmail = event.target.value;
                      const admin = adminUsers.find((user) => user.email === adminEmail);
                      setAnsvarDraft((prev) =>
                        prev.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                adminEmail,
                                adminNavn: admin?.navn || "",
                                note: row.note,
                              }
                            : row
                        )
                      );
                    }}
                    className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Vælg admin</option>
                    {adminUsers.map((admin) => (
                      <option key={admin.email} value={admin.email}>
                        {admin.navn}
                      </option>
                    ))}
                  </select>

                  <label className="mt-3 block text-xs font-medium text-slate-600">Note</label>
                  <input
                    type="text"
                    value={entry.note}
                    onChange={(event) =>
                      setAnsvarDraft((prev) =>
                        prev.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, note: event.target.value } : row
                        )
                      )
                    }
                    placeholder='Fx "styrer rollerne"'
                    className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  />

                  {ansvarDraft.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAnsvarDraft((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                      }
                      className="mt-3 text-xs font-medium text-red-700 hover:underline"
                    >
                      Fjern ansvarlig
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAnsvarDraft((prev) => [...prev, emptyAnsvarDraft()])}
              className="mt-4 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Tilføj ekstra ansvarlig
            </button>

            {ansvarError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ansvarError}</p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={ansvarSaving}
                onClick={() => void saveAnsvarlige()}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {ansvarSaving ? "Gemmer..." : "Gem ansvarlige"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedAnsvarItem(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuller
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
