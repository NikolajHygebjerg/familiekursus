"use client";

import { useEffect, useMemo, useState } from "react";

type Platform = "ios" | "android" | "other";
type Browser = "safari" | "chrome" | "firefox" | "edge" | "samsung" | "other";

const DISMISS_KEY = "familiekursus_a2hs_guide_dismissed_v1";

function detectPlatform(userAgent: string): Platform {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return "other";
}

function detectBrowser(userAgent: string): Browser {
  if (/samsungbrowser/i.test(userAgent)) return "samsung";
  if (/edgios|edga|edg\//i.test(userAgent)) return "edge";
  if (/fxios|firefox/i.test(userAgent)) return "firefox";
  if (/crios|chrome/i.test(userAgent)) return "chrome";
  if (/safari/i.test(userAgent)) return "safari";
  return "other";
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia("(display-mode: standalone)").matches || nav.standalone);
}

function getSteps(platform: Platform, browser: Browser): string[] {
  if (platform === "ios" && browser === "safari") {
    return [
      "Tryk på Del-ikonet nederst i Safari.",
      "Vælg 'Føj til hjemmeskærm'.",
      "Tryk 'Tilføj'.",
    ];
  }
  if (platform === "ios") {
    return [
      "Åbn siden i Safari (kræves på iPhone/iPad).",
      "Tryk på Del-ikonet og vælg 'Føj til hjemmeskærm'.",
      "Tryk 'Tilføj'.",
    ];
  }
  if (platform === "android" && browser === "chrome") {
    return [
      "Tryk på menuen med 3 prikker øverst til højre.",
      "Vælg 'Installer app' eller 'Føj til startskærm'.",
      "Bekræft med 'Installer' eller 'Tilføj'.",
    ];
  }
  if (platform === "android" && browser === "samsung") {
    return [
      "Tryk på menuen i Samsung Internet.",
      "Vælg 'Tilføj side til' > 'Startskærm'.",
      "Bekræft tilføjelsen.",
    ];
  }
  if (platform === "android") {
    return [
      "Åbn browserens menu (typisk 3 prikker).",
      "Vælg 'Føj til startskærm' eller 'Installer app'.",
      "Bekræft tilføjelsen.",
    ];
  }
  return [];
}

export default function AddToHomeScreenGuide() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [browser, setBrowser] = useState<Browser>("other");

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(detectPlatform(ua));
    setBrowser(detectBrowser(ua));
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    setReady(true);
  }, []);

  const shouldShow = useMemo(() => {
    if (!ready || dismissed) return false;
    if (isStandaloneMode()) return false;
    return platform === "ios" || platform === "android";
  }, [ready, dismissed, platform]);

  const steps = useMemo(() => getSteps(platform, browser), [platform, browser]);

  if (!shouldShow || steps.length === 0) return null;

  return (
    <section className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="font-semibold text-slate-800">Gem appen på hjemmeskærmen</p>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          className="text-amber-700 hover:text-amber-800"
          aria-label="Luk guide"
        >
          Luk
        </button>
      </div>
      <ol className="list-decimal space-y-1 pl-5">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-600">
        Bemærk: Forskellige versioner af iOS/Android og forskellige browsere kan vise knapperne
        lidt forskellige steder.
      </p>
    </section>
  );
}
