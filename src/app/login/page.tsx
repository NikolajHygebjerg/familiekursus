"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type Step = "login" | "glemtKode";

type AuthResult = {
  email: string;
  familyName: string | null;
  isAdmin?: boolean;
  adminNavn?: string | null;
  needsWorkshopRegistration?: boolean;
};

function postLoginPath(data: AuthResult): string {
  if (data.isAdmin) return "/";
  if (data.needsWorkshopRegistration) return "/workshop-tilmelding";
  return "/tilmeldte";
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
  const { setAuth, logout, email, isAuthReady, needsWorkshopRegistration, isAdmin } = useAuth();
  const [brugernavnInput, setBrugernavnInput] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
    router.replace(
      !isAdmin && needsWorkshopRegistration ? "/workshop-tilmelding" : isAdmin ? "/" : "/tilmeldte"
    );
  }, [isAuthReady, email, isAdmin, needsWorkshopRegistration, router]);

  const loginSuggestions = Array.from(
    new Set(
      loginHistory.filter((h) =>
        h.toLowerCase().includes(brugernavnInput.trim().toLowerCase())
      )
    )
  ).slice(0, 12);

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
      applyAuthAndRedirect(data, setAuth, router, rememberLogin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fejlede");
    } finally {
      setLoading(false);
    }
  }, [brugernavnInput, code, setAuth, router, rememberLogin]);

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
      applyAuthAndRedirect(data, setAuth, router, rememberLogin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke nulstille kode");
    } finally {
      setLoading(false);
    }
  }, [brugernavnInput, code, setAuth, router, rememberLogin]);

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
          Log ind med brugernavn. Kode er valgfri, medmindre du allerede har valgt en.
        </p>

        {step === "login" && (
          <>
            <label htmlFor="brugernavn" className="mb-1 block text-sm font-medium text-slate-700">
              Brugernavn
            </label>
            <p className="mb-3 text-sm text-slate-500">
              Vælg et brugernavn, I husker — gerne det samme som ved tilmelding til familiekursus.
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

            <label htmlFor="kode" className="mb-1 block text-sm font-medium text-slate-700">
              Kode <span className="font-normal text-slate-500">(valgfri)</span>
            </label>
            <p className="mb-2 text-sm text-slate-500">
              Har du ikke valgt kode før, kan du logge ind uden. Vil du have en kode fremover, vælg
              mindst 4 tegn her. For at afmelde hele familien fra kursus og frigive jeres
              workshoppladser: skriv <strong className="font-medium text-slate-700">Slet</strong> som
              kode (store eller små bogstaver).
            </p>
            <input
              id="kode"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
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
              onKeyDown={(e) => e.key === "Enter" && handleGlemtKode()}
              placeholder="Ny kode (min. 4 tegn)"
              className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              autoFocus
            />
            <div className="flex gap-2">
              <button
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
                onClick={() => void handleGlemtKode()}
                disabled={loading || !code.trim() || code.length < 4}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
              >
                {loading ? "Gemmer..." : "Gem ny kode og log ind"}
              </button>
            </div>
          </>
        )}

        {successMessage && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-emerald-900">
            {successMessage}
          </div>
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
