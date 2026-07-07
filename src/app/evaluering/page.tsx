"use client";

const EVALUERING_FORM_URL = "https://forms.cloud.microsoft/e/sFVNEvzDHC";
const EVALUERING_EMBED_URL = `${EVALUERING_FORM_URL}?embed=true`;

export default function EvalueringPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-4 py-6">
      <header className="mb-4 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Evaluering</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Vi håber I vil udfylde evalueringen af familiekursus 2026. Har I ikke deltaget i et
          programpunkt, springer I bare over spørgsmålet.
        </p>
        <a
          href={EVALUERING_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline"
        >
          Åbn evalueringsskema i ny fane
        </a>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <iframe
          src={EVALUERING_EMBED_URL}
          title="Evalueringsskema – Familiekursus 2026"
          className="h-[75vh] min-h-[32rem] w-full border-0"
          loading="lazy"
        />
      </div>
    </main>
  );
}
