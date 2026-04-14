"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFamily } from "@/context/FamilyContext";
import { useAuth } from "@/context/AuthContext";
import { UGEPROGRAM, type ProgramItem } from "@/data/program";

const WORKSHOPOVERSIGT_SLOTS = ["aftengrupper", "gyserløb", "sheltertur"] as const;

interface ProgramItemWithWorkshops extends Omit<ProgramItem, "workshopSlot"> {
  workshops?: string[];
  workshopSlot?: "workshop1" | "workshop2" | "workshop3" | "workshop4" | "voksen" | "aftengrupper" | "gyserløb" | "sheltertur";
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

function ProgramListItem({
  item,
  showFamilyWorkshops,
  compact,
}: {
  item: ProgramItemWithWorkshops;
  showFamilyWorkshops?: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasWorkshops = item.workshops && item.workshops.length > 0;
  const isExpandable = item.workshopSlot && hasWorkshops;
  const isAftengrupper = item.workshopSlot === "aftengrupper";

  const ArrowIcon = () => (
    <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  const displayTitel = item.tid ? stripTimeFromTitel(item.titel) : item.titel;

  return (
    <div className={compact ? "min-w-0 flex-1" : ""}>
      <div className="flex gap-4">
        {item.tid && (
          <span className="min-w-[5.5rem] shrink-0 whitespace-nowrap text-sm font-medium text-slate-500">
            {formatTid(item.tid)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {isAftengrupper ? (
            <Link href="/tilmeld" className="font-medium text-amber-700 hover:underline">
              {displayTitel}
            </Link>
          ) : isExpandable ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 text-left"
            >
              <span className="font-medium text-slate-800">{displayTitel}</span>
              <span className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}>
                <ArrowIcon />
              </span>
            </button>
          ) : (
            <span className="font-medium text-slate-800">{displayTitel}</span>
          )}
          {showFamilyWorkshops && item.workshopSlot && item.beskrivelse && (
            <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {item.beskrivelse}
            </pre>
          )}
          {expanded && hasWorkshops && (
            <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
              {item.workshops!.map((ws, i) => (
                <li key={i} className="text-sm text-slate-600">• {ws}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProgramPage() {
  const { selectedFamily, isKursusleder } = useFamily();
  const { email } = useAuth();
  const [view, setView] = useState<"uge" | "dag">("uge");
  const [selectedDag, setSelectedDag] = useState(0);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [programData, setProgramData] = useState<DagProgramWithWorkshops[] | null>(null);
  const [programLoading, setProgramLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [workshopoversigt, setWorkshopoversigt] = useState<Record<string, string[]>>({});

  const familyToLoad = isKursusleder ? null : (selectedFamily && selectedFamily.includes("@") ? selectedFamily : null);

  useEffect(() => {
    setProgramLoading(true);
    fetch("/api/program")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => (Array.isArray(data) && data.length > 0 ? data : null))
      .then(setProgramData)
      .catch(() => setProgramData(null))
      .finally(() => setProgramLoading(false));
  }, []);

  useEffect(() => {
       Promise.all(
      WORKSHOPOVERSIGT_SLOTS.map((field) =>
        fetch(`/api/workshopoversigt?field=${encodeURIComponent(field)}`)
          .then((res) => (res.ok ? res.json() : []))
          .then((names: string[]) => ({ field, names }))
      )
    ).then((results) => {
      const map: Record<string, string[]> = {};
      for (const { field, names } of results) map[field] = names;
      setWorkshopoversigt(map);
    });
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

  const baseProgram = programData ?? UGEPROGRAM;

  const dagMedFamilieWorkshops = useMemo((): DagProgramWithWorkshops[] => {
    return baseProgram.map((dag) => ({
      ...dag,
      program: dag.program.map((item) => {
        const slotKey = item.workshopSlot;
        if (!slotKey) return item;

        if (WORKSHOPOVERSIGT_SLOTS.includes(slotKey as (typeof WORKSHOPOVERSIGT_SLOTS)[number])) {
          const names = workshopoversigt[slotKey] || [];
          return {
            ...item,
            workshops: names.length > 0 ? names : undefined,
            beskrivelse: names.length > 0 ? names.join(", ") : "Ingen tilmeldt endnu",
          };
        }

        if (members.length === 0) return item;

        const grouped = new Map<string, string[]>();
        for (const m of members) {
          const ws = m[slotKey as keyof FamilyMember];
          if (ws) {
            const list = grouped.get(ws) || [];
            list.push(m.navn);
            grouped.set(ws, list);
          }
        }

        const workshopLines = Array.from(grouped.entries())
          .map(([ws, navne]) => `${ws}: ${navne.join(", ")}`)
          .join("\n");

        const familyWorkshopNames = Array.from(grouped.keys());

        return {
          ...item,
          workshops: familyWorkshopNames.length > 0 ? familyWorkshopNames : undefined,
          beskrivelse: workshopLines || "Ingen fra familien tilmeldt",
        };
      }),
    }));
  }, [members, baseProgram, workshopoversigt]);

  const dagProgram = dagMedFamilieWorkshops[selectedDag] ?? dagMedFamilieWorkshops[0];
  const loading = programLoading || membersLoading;

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
                <ul className="space-y-3">
                  {dag.program.map((item, i) => (
                    <li key={i}>
                      <ProgramListItem
                        item={item}
                        showFamilyWorkshops={!!familyToLoad}
                      />
                    </li>
                  ))}
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
                <ul className="space-y-3">
                  {dagProgram.program.map((item, i) => (
                    <li key={i}>
                      <ProgramListItem
                        item={item}
                        showFamilyWorkshops={!!familyToLoad}
                      />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-slate-500">Ingen programdata tilgængelig.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
