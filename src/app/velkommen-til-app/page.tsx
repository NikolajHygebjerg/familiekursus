"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AddToHomeScreenGuide from "@/components/AddToHomeScreenGuide";
import { peekPostRegistrationWelcome, consumePostRegistrationWelcome } from "@/lib/post-registration-welcome";

export default function VelkommenTilAppPage() {
  const router = useRouter();
  const { email, isAuthReady, needsWorkshopRegistration, isAdmin } = useAuth();
  const [allowed, setAllowed] = useState(false);

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

  if (!isAuthReady || !allowed) {
    return null;
  }

  return (
    <main className="min-h-screen p-6 pb-24">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="space-y-4 text-slate-700">
          <h1 className="text-2xl font-bold text-slate-800">Velkommen</h1>
          <p className="text-base leading-relaxed">
            Tak for dine workshoptilmeldinger. Du er nu i familiekursets app, som I kan bruge både før kurset
            og under kurset til at huske programmet og hvilke workshops I har tilmeldt jer.
          </p>
          <p className="text-base leading-relaxed">
            Det er smart at gemme siden til din hjemmeskærm, da den herefter vil fungere som en alm. app som husker
            dig uden at skulle logge ind hver gang.
          </p>
        </header>

        <AddToHomeScreenGuide
          ignoreDismiss
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700"
        />

        <button
          type="button"
          onClick={() => {
            consumePostRegistrationWelcome();
            router.replace("/tilmeldte");
          }}
          className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white shadow-md hover:bg-amber-600"
        >
          Gå til dine workshops
        </button>
      </div>
    </main>
  );
}
