"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  detectBrowser,
  detectPlatform,
  getHomeScreenGuideContent,
  isStandaloneMode,
} from "@/lib/add-to-home-screen";
import { peekPostRegistrationWelcome, consumePostRegistrationWelcome } from "@/lib/post-registration-welcome";

export default function VelkommenTilAppPage() {
  const router = useRouter();
  const { email, isAuthReady, needsWorkshopRegistration, isAdmin } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [showHomeScreenHelp, setShowHomeScreenHelp] = useState(false);
  const [envReady, setEnvReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const helpRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setEnvReady(true);
    setStandalone(isStandaloneMode());
  }, []);

  const guide = useMemo(() => {
    if (typeof navigator === "undefined") {
      return getHomeScreenGuideContent("other", "other");
    }
    const ua = navigator.userAgent;
    return getHomeScreenGuideContent(detectPlatform(ua), detectBrowser(ua));
  }, [envReady]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!email || isAdmin) {
      router.replace("/tilmeldte");
      return;
    }
    const showWelcome = peekPostRegistrationWelcome();
    if (showWelcome) {
      setAllowed(true);
      return;
    }
    if (needsWorkshopRegistration) {
      router.replace("/workshop-tilmelding");
      return;
    }
    router.replace("/tilmeldte");
  }, [isAuthReady, email, isAdmin, needsWorkshopRegistration, router]);

  const goToApp = () => {
    consumePostRegistrationWelcome();
    router.replace("/tilmeldte");
  };

  const openHomeScreenHelp = () => {
    setShowHomeScreenHelp(true);
    requestAnimationFrame(() => {
      helpRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  if (!isAuthReady || !allowed) {
    return null;
  }

  return (
    <main className="min-h-screen p-6 pb-24">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="space-y-4 text-slate-700">
          <h1 className="text-2xl font-bold text-slate-800">Velkommen</h1>
          <p className="text-base leading-relaxed">
            Tak for jeres workshoptilmeldinger. Familiekursets app kan I bruge både før og under kurset
            til program og oversigt over workshops.
          </p>
          <p className="text-base leading-relaxed">
            Vi anbefaler, at I gemmer appen på hjemmeskærmen på telefonen — så virker den som en almindelig
            app og husker jer uden at I skal logge ind hver gang.
          </p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={goToApp}
            className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600"
          >
            Gå til app
          </button>
          <button
            type="button"
            onClick={openHomeScreenHelp}
            className="flex-1 rounded-lg border-2 border-amber-500 bg-white px-4 py-3 font-medium text-amber-800 hover:bg-amber-50"
          >
            Gem til hjemmeskærm
          </button>
        </div>

        {showHomeScreenHelp && (
          <section
            ref={helpRef}
            className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-slate-700 shadow-sm"
            aria-live="polite"
          >
            <h2 className="mb-1 text-lg font-semibold text-slate-800">Gem til hjemmeskærm</h2>
            <p className="mb-3 text-xs font-medium text-amber-900">{guide.deviceDescription}</p>

            {standalone ? (
              <p className="text-slate-800">
                Det ser ud til, at I allerede har åbnet Familiekursus som app fra hjemmeskærmen. I er klar
                til at bruge den.
              </p>
            ) : (
              <>
                <p className="mb-3 leading-relaxed">{guide.intro}</p>
                <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
                  {guide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {guide.footnote && (
                  <p className="mt-4 text-xs leading-relaxed text-slate-600">{guide.footnote}</p>
                )}
              </>
            )}

            <button
              type="button"
              onClick={goToApp}
              className="mt-5 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Fortsæt til app
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
