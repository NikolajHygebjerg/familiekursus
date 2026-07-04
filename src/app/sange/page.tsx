"use client";

import { SANGE } from "@/data/sange";

export default function SangePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Sange</h1>
        <p className="mt-2 text-sm text-slate-600">Sangtekster til familiekursus</p>
      </header>

      <div className="space-y-6">
        {SANGE.map((song) => (
          <article
            key={song.title}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <h2 className="border-b border-slate-100 bg-amber-50 px-4 py-3 text-lg font-semibold text-slate-800">
              {song.title}
            </h2>
            <div className="space-y-5 px-4 py-5">
              {song.stanzas.map((stanza, index) => (
                <p
                  key={index}
                  className="whitespace-pre-line text-base leading-relaxed text-slate-700"
                >
                  {stanza.join("\n")}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
