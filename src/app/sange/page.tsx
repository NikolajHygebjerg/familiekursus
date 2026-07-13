"use client";

import { useState } from "react";
import { HOJSKOLE_PDF_PATH, HOJSKOLESANGE } from "@/data/hojskolesange";
import { LEJRBALSSANGE } from "@/data/lejrbalssange";
import { SANGE } from "@/data/sange";

type Tab = "familiekursus" | "lejrbal" | "hojskole";

const LEJRBAL_TOC_ID = "lejrbal-indholdsfortegnelse";
const HOJSKOLE_TOC_ID = "hojskole-indholdsfortegnelse";

function BackToTocLink({ tocId }: { tocId: string }) {
  return (
    <a
      href={`#${tocId}`}
      aria-label="Til indholdsfortegnelse"
      className="mt-0.5 shrink-0 rounded-lg p-1.5 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    </a>
  );
}

function SongCard({
  title,
  subtitle,
  stanzas,
  id,
  showBackToToc,
  tocId = LEJRBAL_TOC_ID,
}: {
  title: string;
  subtitle?: string;
  stanzas: string[][];
  id?: string;
  showBackToToc?: boolean;
  tocId?: string;
}) {
  return (
    <article
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-amber-50 px-4 py-3">
        <h2 className="min-w-0 text-lg font-semibold text-slate-800">
          {title}
          {subtitle && (
            <span className="mt-0.5 block text-sm font-normal text-slate-500">{subtitle}</span>
          )}
        </h2>
        {showBackToToc && <BackToTocLink tocId={tocId} />}
      </div>
      <div className="space-y-5 px-4 py-5">
        {stanzas.map((stanza, index) => (
          <p
            key={index}
            className="whitespace-pre-line text-base leading-relaxed text-slate-700"
          >
            {stanza.join("\n")}
          </p>
        ))}
      </div>
    </article>
  );
}

function PdfSongCard({
  title,
  page,
  id,
  showBackToToc,
}: {
  title: string;
  page: number;
  id: string;
  showBackToToc?: boolean;
}) {
  const pdfUrl = `${HOJSKOLE_PDF_PATH}#page=${page}`;

  return (
    <article
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-amber-50 px-4 py-3">
        <h2 className="min-w-0 text-lg font-semibold text-slate-800">{title}</h2>
        {showBackToToc && <BackToTocLink tocId={HOJSKOLE_TOC_ID} />}
      </div>
      <div className="bg-slate-50">
        <object data={pdfUrl} type="application/pdf" className="h-[min(85vh,960px)] w-full">
          <div className="space-y-3 px-4 py-6 text-sm text-slate-600">
            <p>PDF kan ikke vises direkte i din browser.</p>
            <a href={pdfUrl} className="font-medium text-amber-700 hover:underline">
              Åbn {title} i sangarket
            </a>
          </div>
        </object>
      </div>
    </article>
  );
}

export default function SangePage() {
  const [tab, setTab] = useState<Tab>("familiekursus");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Sange</h1>
        <p className="mt-2 text-sm text-slate-600">Sangtekster til familiekursus</p>
      </header>

      <div className="mb-6 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("familiekursus")}
          className={`flex-1 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
            tab === "familiekursus"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Familiekursussange
        </button>
        <button
          type="button"
          onClick={() => setTab("lejrbal")}
          className={`flex-1 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
            tab === "lejrbal"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Lejrbålssange
        </button>
        <button
          type="button"
          onClick={() => setTab("hojskole")}
          className={`flex-1 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
            tab === "hojskole"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Højskolesange
        </button>
      </div>

      {tab === "familiekursus" && (
        <div className="space-y-6">
          {SANGE.map((song) => (
            <SongCard key={song.title} title={song.title} stanzas={song.stanzas} />
          ))}
        </div>
      )}

      {tab === "lejrbal" && (
        <div className="space-y-6">
          <nav
            id={LEJRBAL_TOC_ID}
            className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Indholdsfortegnelse</h2>
            <ol className="columns-1 gap-x-6 sm:columns-2">
              {LEJRBALSSANGE.map((song, index) => (
                <li key={song.id} className="mb-2 break-inside-avoid">
                  <a href={`#${song.id}`} className="text-sm text-amber-700 hover:underline">
                    {index + 1}. {song.title}
                    {song.artist ? ` – ${song.artist}` : ""}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {LEJRBALSSANGE.map((song) => (
            <SongCard
              key={song.id}
              id={song.id}
              title={song.title}
              subtitle={song.artist}
              stanzas={song.stanzas}
              showBackToToc
            />
          ))}
        </div>
      )}

      {tab === "hojskole" && (
        <div className="space-y-6">
          <nav
            id={HOJSKOLE_TOC_ID}
            className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Indholdsfortegnelse</h2>
            <ol className="columns-1 gap-x-6 sm:columns-2">
              {HOJSKOLESANGE.map((song, index) => (
                <li key={song.id} className="mb-2 break-inside-avoid">
                  <a href={`#${song.id}`} className="text-sm text-amber-700 hover:underline">
                    {index + 1}. {song.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {HOJSKOLESANGE.map((song) => (
            <PdfSongCard
              key={song.id}
              id={song.id}
              title={song.title}
              page={song.page}
              showBackToToc
            />
          ))}
        </div>
      )}
    </main>
  );
}
