"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface FamilyMember {
  navn: string;
  alder: string | null;
}

export default function WorkshopTilmeldingPage() {
  const router = useRouter();
  const { email, familyName, setAuth, isAdmin, isAuthReady } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [fornavn, setFornavn] = useState("");
  const [alder, setAlder] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const fetchMembers = useCallback(() => {
    if (!email) return;
    fetch(`/api/families/email?email=${encodeURIComponent(email)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: FamilyMember[]) => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]));
  }, [email]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!email) {
      router.replace("/login");
      return;
    }
    if (isAdmin) {
      router.replace("/program");
    }
  }, [isAuthReady, email, isAdmin, router]);

  useEffect(() => {
    if (!email || isAdmin) return;
    fetchMembers();
    setLoading(false);
  }, [email, isAdmin, fetchMembers]);

  const resetForm = useCallback(() => {
    setFornavn("");
    setAlder("");
    setError(null);
  }, []);

  const submit = useCallback(
    async (andFinish: boolean) => {
      if (!email || !fornavn.trim()) {
        setError("Udfyld fornavn");
        return;
      }
      if (!alder.trim()) {
        setError("Udfyld alder");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/workshop-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            navn: fornavn.trim(),
            alder: alder.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fejl ved tilmelding");

        if (andFinish) {
          setAuth(email, familyName || email, false);
          setDone(true);
        } else {
          resetForm();
          fetchMembers();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fejl");
      } finally {
        setSubmitting(false);
      }
    },
    [email, fornavn, alder, setAuth, familyName, resetForm, fetchMembers]
  );

  if (!email) return null;

  if (done) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="max-w-md rounded-xl bg-white p-8 shadow-lg">
          <h1 className="mb-4 text-center text-2xl font-bold text-slate-800">Tak for tilmeldingen</h1>
          <p className="text-center text-slate-600">
            Jeres familiemedlemmer er gemt. I kan tilføje flere senere under appen, hvis I har brug
            for det.
          </p>
          <button
            onClick={() => router.push("/program")}
            className="mt-6 w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600"
          >
            Gå til appen
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 pb-24">
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Tilmelding</h1>
        <p className="mb-6 text-sm text-slate-600">
          Angiv <strong>fornavn</strong> og <strong>alder</strong> for hver person i jeres familie. Intet
          andet er nødvendigt her.
        </p>

        {members.length > 0 && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Allerede tilføjet</h2>
            <ul className="divide-y divide-slate-100 text-sm text-slate-800">
              {members.map((m) => (
                <li key={`${m.navn}-${m.alder}`} className="flex justify-between py-2">
                  <span>{m.navn}</span>
                  <span className="text-slate-500">
                    {m.alder != null && m.alder !== "" ? `${m.alder} år` : "—"}
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
            <div>
              <label htmlFor="fornavn" className="mb-1 block text-sm font-medium text-slate-700">
                Fornavn
              </label>
              <input
                id="fornavn"
                type="text"
                value={fornavn}
                onChange={(e) => setFornavn(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
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
                value={alder}
                onChange={(e) => setAlder(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder="Fx 12"
                inputMode="numeric"
              />
            </div>

            {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void submit(false)}
                disabled={submitting || !fornavn.trim() || !alder.trim()}
                className="flex-1 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                Gem og tilføj næste
              </button>
              <button
                type="button"
                onClick={() => void submit(true)}
                disabled={submitting || !fornavn.trim() || !alder.trim()}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-3 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                Gem og afslut
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
