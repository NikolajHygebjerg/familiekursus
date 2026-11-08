"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthBranding from "@/components/AuthBranding";
import { AuthResult, clearLegacyLoginHistory, postLoginPath } from "@/lib/auth-client";

type Step = "login" | "glemtKode";

export default function LogIndPage() {
  const router = useRouter();
  const { setAuth, logout, email, isAuthReady, needsWorkshopRegistration, isAdmin } = useAuth();
  const [brugernavnInput, setBrugernavnInput] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  useEffect(() => {
    clearLegacyLoginHistory();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !email) return;
    router.replace(
      !isAdmin && needsWorkshopRegistration ? "/workshop-tilmelding" : isAdmin ? "/" : "/tilmeldte"
    );
  }, [isAuthReady, email, isAdmin, needsWorkshopRegistration, router]);

  const applyAuthAndRedirect = useCallback(
    (data: AuthResult) => {
      setAuth(
        data.email,
        data.familyName,
        data.needsWorkshopRegistration ?? false,
        Boolean(data.isAdmin),
        data.adminNavn ?? null
      );
      router.replace(postLoginPath(data));
    },
    [router, setAuth]
  );

  const handleLogin = useCallback(async () => {
    const login = brugernavnInput.trim();
    if (!login) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          brugernavn: login,
          code: code.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login fejlede");
      if (data.deleted === true) {
        logout();
        setBrugernavnInput("");
        setCode("");
        setSuccessMessage(
          typeof data.message === "string"
            ? data.message
            : "Familien er afmeldt, og pladserne er frigivet."
        );
        return;
      }
      applyAuthAndRedirect(data as AuthResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fejlede");
    } finally {
      setLoading(false);
    }
  }, [brugernavnInput, code, logout, applyAuthAndRedirect]);

  const handleGlemtKode = useCallback(async () => {
    const login = brugernavnInput.trim();
    if (!login || !code.trim() || code.length < 4) {
      setError("Vælg en ny kode på mindst 4 tegn");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resetCode",
          brugernavn: login,
          code: code.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunne ikke nulstille kode");
      applyAuthAndRedirect(data as AuthResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke nulstille kode");
    } finally {
      setLoading(false);
    }
  }, [brugernavnInput, code, applyAuthAndRedirect]);

  if (!isAuthReady || email) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <AuthBranding />
        <h1 className="mb-2 text-center text-2xl font-bold text-slate-800">Log ind</h1>
        <p className="mb-8 text-center text-slate-600">
          Log ind med jeres brugernavn og den kode, I valgte da familien blev oprettet.
        </p>

        {step === "login" && (
          <>
            <label htmlFor="brugernavn" className="mb-1 block text-sm font-medium text-slate-700">
              Brugernavn
            </label>
            <input
              id="brugernavn"
              type="text"
              value={brugernavnInput}
              onChange={(e) => setBrugernavnInput(e.target.value)}
              placeholder="Jeres brugernavn"
              className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />

            <label htmlFor="kode" className="mb-1 block text-sm font-medium text-slate-700">
              Kode
            </label>
            <p className="mb-2 text-sm text-slate-500">
              For at afmelde hele familien: skriv <strong className="font-medium text-slate-700">Slet</strong>{" "}
              som kode.
            </p>
            <input
              id="kode"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
              placeholder="Din kode"
              className="mb-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => {
                setStep("glemtKode");
                setCode("");
                setError(null);
              }}
              className="mb-4 text-sm text-amber-600 hover:text-amber-700 hover:underline"
            >
              Glemt kode?
            </button>

            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading || !brugernavnInput.trim()}
              className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? "Logger ind..." : "Log ind"}
            </button>
          </>
        )}

        {step === "glemtKode" && (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Vælg en ny kode (mindst 4 tegn). Den erstatter den gamle, hvis du havde en.
            </p>
            <input
              type="text"
              value={brugernavnInput}
              readOnly
              className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600"
            />
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleGlemtKode()}
              placeholder="Ny kode (min. 4 tegn)"
              className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep("login");
                  setCode("");
                  setError(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Tilbage
              </button>
              <button
                type="button"
                onClick={() => void handleGlemtKode()}
                disabled={loading || !code.trim() || code.length < 4}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
              >
                {loading ? "Gemmer..." : "Gem ny kode og log ind"}
              </button>
            </div>
          </>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Har I ikke oprettet jeres familie endnu?{" "}
          <Link href="/velkommen" className="font-medium text-amber-600 hover:text-amber-700 hover:underline">
            Opret familie
          </Link>
        </p>

        {successMessage && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-emerald-900">{successMessage}</div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
        )}
      </div>
    </main>
  );
}
