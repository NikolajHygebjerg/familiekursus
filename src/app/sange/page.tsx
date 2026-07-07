"use client";

import { useState } from "react";
import { LEJRBALSSANGE } from "@/data/lejrbalssange";
import { SANGE } from "@/data/sange";

type Tab = "familiekursus" | "lejrbal";

const LEJRBAL_TOC_ID = "lejrbal-indholdsfortegnelse";

function SongCard({
  title,
  subtitle,
  stanzas,
  id,
  showBackToToc,
}: {
  title: string;
  subtitle?: string;
  stanzas: string[][];
  id?: string;
  showBackToToc?: boolean;
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
        {showBackToToc && (
          <a
            href={`#${LEJRBAL_TOC_ID}`}
            aria-label="Til indholdsfortegnelse"
            className="mt-0.5 shrink-0 rounded-lg p-1.5 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </a>
        )}
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
          className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
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
          className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            tab === "lejrbal"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Lejrbålssange
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
                  <a
                    href={`#${song.id}`}
                    className="text-sm text-amber-700 hover:underline"
                  >
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
    </main>
  );
}
