"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthBranding from "@/components/AuthBranding";
import {
  AuthResult,
  postLoginPath,
  pushLoginHistory,
  readLoginHistory,
} from "@/lib/auth-client";

export default function VelkommenPage() {
  const router = useRouter();
  const { setAuth, email, isAuthReady, needsWorkshopRegistration, isAdmin } = useAuth();
  const [brugernavnInput, setBrugernavnInput] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginHistory, setLoginHistory] = useState<string[]>(() => readLoginHistory());
  const [showLoginSuggestions, setShowLoginSuggestions] = useState(false);

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

  const rememberLogin = useCallback((value: string) => {
    setLoginHistory((prev) => pushLoginHistory(prev, value));
  }, []);

  const handleOpret = useCallback(async () => {
    const login = brugernavnInput.trim();
    const kode = code.trim();
    if (!login) {
      setError("Angiv et brugernavn");
      return;
    }
    if (kode.length < 4) {
      setError("Vælg en kode på mindst 4 tegn");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          brugernavn: login,
          code: kode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Kunne ikke oprette familie");
      }
      const auth = data as AuthResult;
      setAuth(
        auth.email,
        auth.familyName,
        auth.needsWorkshopRegistration ?? false,
        Boolean(auth.isAdmin),
        auth.adminNavn ?? null
      );
      rememberLogin(auth.email);
      router.replace(postLoginPath(auth));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette familie");
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
        <AuthBranding />
        <h1 className="mb-8 text-center text-2xl font-bold text-slate-800">Opret familie</h1>

        <label htmlFor="brugernavn" className="mb-1 block text-sm font-medium text-slate-700">
          Brugernavn
        </label>
        <p className="mb-3 text-sm text-slate-500">
          Skriv det brugernavn I brugte ved tilmelding til familiekursus.
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
          Kode
        </label>
        <p className="mb-3 text-sm text-slate-500">
          Vælg selv en kode så du fremover kan logge ind
        </p>
        <input
          id="kode"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleOpret()}
          placeholder="Din kode (min. 4 tegn)"
          className="mb-6 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          autoComplete="new-password"
        />

        <button
          type="button"
          onClick={() => void handleOpret()}
          disabled={loading || !brugernavnInput.trim() || code.trim().length < 4}
          className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? "Opretter..." : "Opret familie"}
        </button>

        <p className="mt-6 text-center text-sm text-slate-600">
          Er din familie allerede oprettet?{" "}
          <Link href="/log-ind" className="font-medium text-amber-600 hover:text-amber-700 hover:underline">
            Så log ind her
          </Link>
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
            {error.includes("allerede") && (
              <p className="mt-2">
                <Link href="/log-ind" className="font-medium text-amber-700 underline">
                  Gå til log ind
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
