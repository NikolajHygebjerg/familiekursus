"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import NameAutocomplete from "@/components/NameAutocomplete";

type ActivityKey = "aftengrupper" | "gyserløb" | "sheltertur";

const ACTIVITIES: { key: ActivityKey; label: string }[] = [
  { key: "aftengrupper", label: "Aftengrupper" },
  { key: "gyserløb", label: "Gyserløb" },
  { key: "sheltertur", label: "Sheltertur" },
];

export default function TilmeldPage() {
  const { email } = useAuth();
  const [aftengrupperOptions, setAftengrupperOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState<ActivityKey | null>(null);
  const [success, setSuccess] = useState<ActivityKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Aftengrupper form
  const [aftenNavn, setAftenNavn] = useState("");
  const [aftenValg, setAftenValg] = useState("");
  const [aftenType, setAftenType] = useState<"Voksen" | "Barn">("Voksen");
  const [aftenAlder, setAftenAlder] = useState("");

  // Gyserløb form
  const [gyserNavn, setGyserNavn] = useState("");
  const [gyserType, setGyserType] = useState<"Voksen" | "Barn">("Voksen");
  const [gyserAlder, setGyserAlder] = useState("");

  // Sheltertur form
  const [shelterNavn, setShelterNavn] = useState("");
  const [shelterType, setShelterType] = useState<"Voksen" | "Barn">("Voksen");
  const [shelterAlder, setShelterAlder] = useState("");

  useEffect(() => {
    fetch("/api/workshopoversigt?options=aftengrupper")
      .then((res) => (res.ok ? res.json() : []))
      .then(setAftengrupperOptions)
      .catch(() => setAftengrupperOptions([]))
      .finally(() => setLoadingOptions(false));
  }, []);

  const resetAftengrupper = useCallback(() => {
    setAftenNavn("");
    setAftenValg("");
    setAftenType("Voksen");
    setAftenAlder("");
    setError(null);
  }, []);

  const resetGyserløb = useCallback(() => {
    setGyserNavn("");
    setGyserType("Voksen");
    setGyserAlder("");
    setError(null);
  }, []);

  const resetSheltertur = useCallback(() => {
    setShelterNavn("");
    setShelterType("Voksen");
    setShelterAlder("");
    setError(null);
  }, []);

  const handleAftengrupper = useCallback(
    async () => {
      if (!aftenNavn.trim()) {
        setError("Udfyld navn");
        return;
      }
      if (!aftenValg) {
        setError("Vælg en aftengruppe");
        return;
      }
      if (aftenType === "Barn" && !aftenAlder.trim()) {
        setError("Udfyld alder for barn");
        return;
      }
      setSubmitting("aftengrupper");
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch("/api/workshopoversigt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field: "aftengrupper",
            navn: aftenNavn.trim(),
            email,
            valgtOption: aftenValg,
            type: aftenType,
            alder: aftenType === "Barn" ? aftenAlder.trim() : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fejl");
        setSuccess("aftengrupper");
        resetAftengrupper();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fejl ved tilmelding");
      } finally {
        setSubmitting(null);
      }
    },
    [aftenNavn, aftenValg, aftenType, aftenAlder, email, resetAftengrupper]
  );

  const handleGyserløb = useCallback(
    async () => {
      if (!gyserNavn.trim()) {
        setError("Udfyld navn");
        return;
      }
      if (gyserType === "Barn" && !gyserAlder.trim()) {
        setError("Udfyld alder for barn");
        return;
      }
      if (gyserType === "Barn") {
        const alderNum = parseInt(gyserAlder.trim(), 10);
        if (isNaN(alderNum) || alderNum < 11) {
          setError("Man skal være mindst 11 år for at deltage i gyserløb");
          return;
        }
      }
      setSubmitting("gyserløb");
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch("/api/workshopoversigt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field: "gyserløb",
            navn: gyserNavn.trim(),
            email,
            type: gyserType,
            alder: gyserType === "Barn" ? gyserAlder.trim() : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fejl");
        setSuccess("gyserløb");
        resetGyserløb();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fejl ved tilmelding");
      } finally {
        setSubmitting(null);
      }
    },
    [gyserNavn, gyserType, gyserAlder, email, resetGyserløb]
  );

  const handleSheltertur = useCallback(
    async () => {
      if (!shelterNavn.trim()) {
        setError("Udfyld navn");
        return;
      }
      if (shelterType === "Barn" && !shelterAlder.trim()) {
        setError("Udfyld alder for barn");
        return;
      }
      setSubmitting("sheltertur");
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch("/api/workshopoversigt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field: "sheltertur",
            navn: shelterNavn.trim(),
            email,
            type: shelterType,
            alder: shelterType === "Barn" ? shelterAlder.trim() : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fejl");
        setSuccess("sheltertur");
        resetSheltertur();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fejl ved tilmelding");
      } finally {
        setSubmitting(null);
      }
    },
    [shelterNavn, shelterType, shelterAlder, email, resetSheltertur]
  );

  if (!email) return null;

  return (
    <main className="min-h-screen p-6 pb-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">Tilmeld</h1>
        <p className="mb-8 text-slate-600">
          Tilmeld til aftengrupper, gyserløb og sheltertur.
        </p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
        )}

        <div className="space-y-8">
          {/* Aftengrupper */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Aftengrupper</h2>
            <p className="mb-4 text-sm text-slate-600">
              Vælg en person fra din familie (skal være tilmeldt workshops) og aftengruppe.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Navn</label>
                <NameAutocomplete
                  value={aftenNavn}
                  onChange={setAftenNavn}
                  email={email}
                  placeholder="Skriv navn (fx Nikolaj) – vælg fra listen"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Voksen/barn</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="aften-type"
                      checked={aftenType === "Voksen"}
                      onChange={() => setAftenType("Voksen")}
                    />
                    Voksen
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="aften-type"
                      checked={aftenType === "Barn"}
                      onChange={() => setAftenType("Barn")}
                    />
                    Barn
                  </label>
                </div>
              </div>
              {aftenType === "Barn" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Alder</label>
                  <input
                    type="text"
                    value={aftenAlder}
                    onChange={(e) => setAftenAlder(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="Fx 12"
                  />
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Vælg aftengruppe
                </label>
                <select
                  value={aftenValg}
                  onChange={(e) => setAftenValg(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  disabled={loadingOptions}
                >
                  <option value="">Vælg...</option>
                  {aftengrupperOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAftengrupper}
                disabled={
                  submitting === "aftengrupper" ||
                  !aftenNavn.trim() ||
                  !aftenValg ||
                  (aftenType === "Barn" && !aftenAlder.trim())
                }
                className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {submitting === "aftengrupper" ? "Tilføjer..." : "Tilføj"}
              </button>
              {success === "aftengrupper" && (
                <p className="text-sm text-green-600">Tilmeldt!</p>
              )}
            </form>
          </section>

          {/* Gyserløb */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Gyserløb</h2>
            <p className="mb-4 text-sm text-slate-600">
              Vælg en person fra din familie. Ved barn skal alder udfyldes. Man skal være mindst 11 år.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Navn</label>
                <NameAutocomplete
                  value={gyserNavn}
                  onChange={setGyserNavn}
                  email={email}
                  placeholder="Skriv navn (fx Sofus) – vælg fra listen"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Voksen/barn</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gyser-type"
                      checked={gyserType === "Voksen"}
                      onChange={() => setGyserType("Voksen")}
                    />
                    Voksen
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gyser-type"
                      checked={gyserType === "Barn"}
                      onChange={() => setGyserType("Barn")}
                    />
                    Barn
                  </label>
                </div>
              </div>
              {gyserType === "Barn" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Alder (min. 11 år)</label>
                  <input
                    type="text"
                    value={gyserAlder}
                    onChange={(e) => setGyserAlder(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="Fx 12"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={handleGyserløb}
                disabled={
                  submitting === "gyserløb" ||
                  !gyserNavn.trim() ||
                  (gyserType === "Barn" && (!gyserAlder.trim() || parseInt(gyserAlder.trim(), 10) < 11))
                }
                className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {submitting === "gyserløb" ? "Tilføjer..." : "Tilføj"}
              </button>
              {success === "gyserløb" && (
                <p className="text-sm text-green-600">Tilmeldt!</p>
              )}
            </form>
          </section>

          {/* Sheltertur */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Sheltertur</h2>
            <p className="mb-4 text-sm text-slate-600">
              Vælg en person fra din familie. Ved barn skal alder udfyldes.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Navn</label>
                <NameAutocomplete
                  value={shelterNavn}
                  onChange={setShelterNavn}
                  email={email}
                  placeholder="Skriv navn (fx Sofus) – vælg fra listen"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Voksen/barn</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="shelter-type"
                      checked={shelterType === "Voksen"}
                      onChange={() => setShelterType("Voksen")}
                    />
                    Voksen
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="shelter-type"
                      checked={shelterType === "Barn"}
                      onChange={() => setShelterType("Barn")}
                    />
                    Barn
                  </label>
                </div>
              </div>
              {shelterType === "Barn" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Alder</label>
                  <input
                    type="text"
                    value={shelterAlder}
                    onChange={(e) => setShelterAlder(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    placeholder="Fx 12"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={handleSheltertur}
                disabled={
                  submitting === "sheltertur" ||
                  !shelterNavn.trim() ||
                  (shelterType === "Barn" && !shelterAlder.trim())
                }
                className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {submitting === "sheltertur" ? "Tilføjer..." : "Tilføj"}
              </button>
              {success === "sheltertur" && (
                <p className="text-sm text-green-600">Tilmeldt!</p>
              )}
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
