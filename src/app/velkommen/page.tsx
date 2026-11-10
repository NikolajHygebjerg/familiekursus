"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AuthBranding from "@/components/AuthBranding";
import { AuthResult, clearLegacyLoginHistory, postLoginPath } from "@/lib/auth-client";
import { rejectAtInBrugernavn } from "@/lib/brugernavn";
import { USER_TERMS_CHECKBOX_LABEL } from "@/lib/user-terms";

export default function VelkommenPage() {
  const router = useRouter();
  const { setAuth, email, isAuthReady, needsWorkshopRegistration, isAdmin } = useAuth();
  const [brugernavnInput, setBrugernavnInput] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    clearLegacyLoginHistory();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !email) return;
    router.replace(
      !isAdmin && needsWorkshopRegistration ? "/workshop-tilmelding" : isAdmin ? "/" : "/tilmeldte"
    );
  }, [isAuthReady, email, isAdmin, needsWorkshopRegistration, router]);

  const handleOpret = useCallback(async () => {
    const login = brugernavnInput.trim();
    const kode = code.trim();
    const brugernavnError = rejectAtInBrugernavn(login);
    if (brugernavnError) {
      setError(brugernavnError);
      return;
    }
    if (kode.length < 4) {
      setError("Vælg en kode på mindst 4 tegn");
      return;
    }
    if (!acceptedTerms) {
      setError("Du skal acceptere betingelserne, før familien kan oprettes");
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
          acceptedTerms: true,
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
      router.replace(postLoginPath(auth));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette familie");
    } finally {
      setLoading(false);
    }
  }, [brugernavnInput, code, acceptedTerms, setAuth, router]);

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
          Skriv det brugernavn I brugte ved tilmelding til familiekursus. Det må ikke være en
          e-mailadresse (ingen @) — vi gemmer ikke e-mail som login af hensyn til GDPR.
        </p>
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
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          autoComplete="new-password"
        />

        <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <span>
            {USER_TERMS_CHECKBOX_LABEL}{" "}
            <Link
              href="/betingelser"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-700 underline hover:text-amber-800"
            >
              (læs betingelserne)
            </Link>
          </span>
        </label>

        <button
          type="button"
          onClick={() => void handleOpret()}
          disabled={
            loading || !brugernavnInput.trim() || code.trim().length < 4 || !acceptedTerms
          }
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
