"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type Step = "brugernavn" | "code" | "create" | "setCode" | "glemtKode";

type AuthResult = {
  email: string;
  familyName: string | null;
  isAdmin?: boolean;
  adminNavn?: string | null;
  needsWorkshopRegistration?: boolean;
};

function postLoginPath(data: AuthResult): string {
  return data.isAdmin ? "/program" : "/workshop-tilmelding";
}

function applyAuthAndRedirect(
  data: AuthResult,
  setAuth: ReturnType<typeof useAuth>["setAuth"],
  router: ReturnType<typeof useRouter>,
  rememberLogin: (login: string) => void
) {
  setAuth(
    data.email,
    data.familyName,
    data.needsWorkshopRegistration ?? false,
    Boolean(data.isAdmin),
    data.adminNavn ?? null
  );
  rememberLogin(data.email);
  router.replace(postLoginPath(data));
}

const LOGIN_HISTORY_KEY = "familiekursus_login_history";
const MAX_HISTORY = 12;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, email, isAuthReady, needsWorkshopRegistration, isAdmin } = useAuth();
  const [brugernavnInput, setBrugernavnInput] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("brugernavn");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginHistory, setLoginHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw =
        localStorage.getItem(LOGIN_HISTORY_KEY) ||
        localStorage.getItem("familiekursus_login_email_history");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
    } catch {
      return [];
    }
  });
  const [showLoginSuggestions, setShowLoginSuggestions] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    existsIn2026: boolean;
    hasBruger: boolean;
    needsSetCode: boolean;
    nextStep: "code" | "setCode" | "create";
    familyName: string | null;
    needsWorkshopRegistration: boolean;
    isAdmin?: boolean;
  } | null>(null);

  const rememberLogin = useCallback((value: string) => {
    const login = value.trim();
    if (!login) return;
    setLoginHistory((prev) => {
      const next = [login, ...prev.filter((x) => x !== login)].slice(0, MAX_HISTORY);
      localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isAuthReady || !email) return;
    router.replace(!isAdmin && needsWorkshopRegistration ? "/workshop-tilmelding" : "/program");
  }, [isAuthReady, email, isAdmin, needsWorkshopRegistration, router]);

  const loginSuggestions = Array.from(
    new Set(
      loginHistory.filter((h) =>
        h.toLowerCase().includes(brugernavnInput.trim().toLowerCase())
      )
    )
  ).slice(0, 12);

  const loginPayload = (action: string, extra?: Record<string, string>) =>
    JSON.stringify({ action, brugernavn: brugernavnInput.trim(), ...extra });

  const handleBrugernavnSubmit = useCallback(async () => {
    if (!brugernavnInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: loginPayload("check"),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fejl");
      setCheckResult(data);
      setStep(data.nextStep);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tjekke brugernavn");
    } finally {
      setLoading(false);
    }
  }, [brugernavnInput]);

  const handleLogin = useCallback(async () => {
    const e = brugernavnInput.trim().toLowerCase();
    if (!e || !code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: loginPayload("login", { code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Forkert brugernavn eller kode");
      applyAuthAndRedirect(data, setAuth, router, rememberLogin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fejlede");
    } finally {
      setLoading(false);
    }
  }, [brugernavnInput, code, setAuth, router, rememberLogin]);

  const handleCreateUser = useCallback(async () => {
    const e = brugernavnInput.trim().toLowerCase();
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
        body: loginPayload("create", { code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunne ikke oprette bruger");
      applyAuthAndRedirect(data, setAuth, router, rememberLogin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Oprettelse fejlede");
    } finally {
      setLoading(false);
    }
  }, [brugernavnInput, code, setAuth, router, rememberLogin]);

  const handleGlemtKode = useCallback(async () => {
    const e = brugernavnInput.trim().toLowerCase();
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
        body: loginPayload("resetCode", { code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunne ikke nulstille kode");
      applyAuthAndRedirect(data, setAuth, router, rememberLogin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke nulstille kode");
    } finally {
      setLoading(false);
    }
  }, [brugernavnInput, code, setAuth, router, rememberLogin]);

  const handleSetCode = useCallback(async () => {
    const e = brugernavnInput.trim().toLowerCase();
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
        body: loginPayload("setCode", { code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunne ikke gemme kode");
      applyAuthAndRedirect(data, setAuth, router, rememberLogin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme kode");
    } finally {
      setLoading(false);
    }
  }, [brugernavnInput, code, setAuth, router, rememberLogin]);

  const reset = () => {
    setStep("brugernavn");
    setCode("");
    setError(null);
    setCheckResult(null);
  };

  if (!isAuthReady || email) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image
            src="/images/logo.jpg"
            alt="Familiekursus"
            width={128}
            height={128}
            className="rounded-2xl shadow-md"
            priority
          />
        </div>
        <h1 className="mb-2 text-center text-2xl font-bold text-slate-800">
          Familiekursus
        </h1>
        <p className="mb-8 text-center text-slate-600">
          Log ind med brugernavn og din personlige kode
        </p>

        {step === "brugernavn" && (
          <>
            <label htmlFor="brugernavn" className="mb-1 block text-sm font-medium text-slate-700">
              Brugernavn
            </label>
            <p className="mb-3 text-sm text-slate-500">
              Vælg et brugernavn, I husker — gerne det samme, som I brugte ved tilmeldingen til
              familiekursus.
            </p>
            <div className="relative">
              <input
                id="brugernavn"
                type="text"
                value={brugernavnInput}
                onChange={(e) => {
                  setBrugernavnInput(e.target.value);
                  setShowLoginSuggestions(true);
                }}
                onFocus={() => setShowLoginSuggestions(true)}
                onBlur={() => setTimeout(() => setShowLoginSuggestions(false), 150)}
                onKeyDown={(e) => e.key === "Enter" && handleBrugernavnSubmit()}
                placeholder="Jeres brugernavn"
                className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                autoFocus
                autoComplete="username"
              />
              {showLoginSuggestions && loginSuggestions.length > 0 && (
                <ul className="absolute z-10 mt-[-12px] max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {loginSuggestions.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => {
                          setBrugernavnInput(suggestion);
                          setShowLoginSuggestions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-slate-800 hover:bg-amber-50"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={handleBrugernavnSubmit}
              disabled={loading || !brugernavnInput.trim()}
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
                ? checkResult?.existsIn2026
                  ? "Velkommen! Vælg en personlig kode (mindst 4 tegn) — du gemmer den her og bruger den ved login fremover:"
                  : "Vælg en personlig kode (mindst 4 tegn), som du vil bruge til at logge ind fremover:"
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
                disabled={loading || !code.trim() || (step === "setCode" && code.length < 4)}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
              >
                {loading
                  ? step === "setCode"
                    ? "Gemmer..."
                    : "Logger ind..."
                  : step === "setCode"
                    ? "Gem kode og log ind"
                    : "Log ind"}
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
              type="text"
              value={brugernavnInput}
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
              Vælg en personlig kode (mindst 4 tegn). Systemet husker koden, så I kan logge ind med
              brugernavn og kode fremover.
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
