"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type Step = "email" | "code" | "create" | "setCode" | "glemtKode";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{
    existsIn2026: boolean;
    hasBruger: boolean;
    defaultCode: boolean;
    familyName: string | null;
    needsWorkshopRegistration: boolean;
  } | null>(null);

  const handleEmailSubmit = useCallback(async () => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", email: e }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fejl");
      setCheckResult(data);
      if (data.hasBruger) {
        setStep("code");
      } else if (data.defaultCode) {
        setStep("setCode");
      } else {
        setStep("create");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tjekke email");
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleLogin = useCallback(async () => {
    const e = email.trim().toLowerCase();
    if (!e || !code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email: e, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Forkert kode eller email");
      setAuth(data.email, data.familyName, data.needsWorkshopRegistration);
      router.replace("/program");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fejlede");
    } finally {
      setLoading(false);
    }
  }, [email, code, setAuth, router]);

  const handleCreateUser = useCallback(async () => {
    const e = email.trim().toLowerCase();
    if (!e || !code.trim() || code.length < 4) {
      setError("Vælg en kode på mindst 4 tegn");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", email: e, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunne ikke oprette bruger");
      setAuth(data.email, data.familyName, data.needsWorkshopRegistration ?? false);
      router.replace("/program");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Oprettelse fejlede");
    } finally {
      setLoading(false);
    }
  }, [email, code, setAuth, router]);

  const handleGlemtKode = useCallback(async () => {
    const e = email.trim().toLowerCase();
    if (!e || !code.trim() || code.length < 4) {
      setError("Vælg en ny kode på mindst 4 tegn");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetCode", email: e, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunne ikke nulstille kode");
      setAuth(data.email, data.familyName, data.needsWorkshopRegistration ?? false);
      router.replace("/program");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke nulstille kode");
    } finally {
      setLoading(false);
    }
  }, [email, code, setAuth, router]);

  const handleSetCode = useCallback(async () => {
    const e = email.trim().toLowerCase();
    if (!e || !code.trim() || code.length < 4) {
      setError("Vælg en kode på mindst 4 tegn");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setCode", email: e, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunne ikke gemme kode");
      setAuth(data.email, data.familyName, data.needsWorkshopRegistration ?? false);
      router.replace("/program");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme kode");
    } finally {
      setLoading(false);
    }
  }, [email, code, setAuth, router]);

  const reset = () => {
    setStep("email");
    setCode("");
    setError(null);
    setCheckResult(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-2xl font-bold text-slate-800">
          Familiekursus
        </h1>
        <p className="mb-8 text-center text-slate-600">
          Log ind med din email
        </p>

        {step === "email" && (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
              placeholder="Din email"
              className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              autoFocus
            />
            <button
              onClick={handleEmailSubmit}
              disabled={loading || !email.trim()}
              className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? "Tjekker..." : "Fortsæt"}
            </button>
          </>
        )}

        {(step === "code" || step === "setCode") && (
          <>
            <p className="mb-2 text-sm text-slate-600">
              {step === "setCode"
                ? "Det er første gang du logger ind. Vælg en kode til dig selv (mindst 4 tegn):"
                : "Indtast din kode:"}
            </p>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (step === "code" ? handleLogin() : handleSetCode())}
              placeholder="Kode"
              className="mb-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              autoFocus
            />
            {step === "code" && (
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
            )}
            {step === "setCode" && <div className="mb-4" />}
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Tilbage
              </button>
              <button
                onClick={step === "code" ? handleLogin : handleSetCode}
                disabled={loading || !code.trim()}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
              >
                {loading ? "Logger ind..." : "Log ind"}
              </button>
            </div>
          </>
        )}

        {step === "glemtKode" && (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Vælg en ny kode (mindst 4 tegn). Din gamle kode erstattes.
            </p>
            <input
              type="email"
              value={email}
              readOnly
              className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600"
            />
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGlemtKode()}
              placeholder="Ny kode (min. 4 tegn)"
              className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStep("code");
                  setCode("");
                  setError(null);
                }}
                className="rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Tilbage
              </button>
              <button
                onClick={handleGlemtKode}
                disabled={loading || !code.trim() || code.length < 4}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
              >
                {loading ? "Gemmer..." : "Nulstil kode"}
              </button>
            </div>
          </>
        )}

        {step === "create" && (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Din email findes ikke i systemet. Opret en bruger med din email og en kode (mindst 4 tegn):
            </p>
            <input
              type="email"
              value={email}
              readOnly
              className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600"
            />
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateUser()}
              placeholder="Vælg en kode (min. 4 tegn)"
              className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Tilbage
              </button>
              <button
                onClick={handleCreateUser}
                disabled={loading || !code.trim() || code.length < 4}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
              >
                {loading ? "Opretter..." : "Opret bruger"}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
