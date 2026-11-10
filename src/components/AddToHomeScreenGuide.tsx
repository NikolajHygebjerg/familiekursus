"use client";

import { useEffect, useMemo, useState } from "react";
import {
  detectBrowser,
  detectPlatform,
  getHomeScreenGuideContent,
  isStandaloneMode,
  type Browser,
  type Platform,
} from "@/lib/add-to-home-screen";

const DISMISS_KEY = "familiekursus_a2hs_guide_dismissed_v1";

type AddToHomeScreenGuideProps = {
  className?: string;
  /** Efter workshop-tilmelding: vis selv om brugeren tidligere har lukket guiden. */
  ignoreDismiss?: boolean;
};

export default function AddToHomeScreenGuide({
  className,
  ignoreDismiss = false,
}: AddToHomeScreenGuideProps) {
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
    if (!ready) return false;
    if (!ignoreDismiss && dismissed) return false;
    if (isStandaloneMode()) return false;
    return platform === "ios" || platform === "android";
  }, [ready, dismissed, ignoreDismiss, platform]);

  const guide = useMemo(() => getHomeScreenGuideContent(platform, browser), [platform, browser]);

  if (!shouldShow) return null;

  return (
    <section
      className={
        className ??
        "mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700"
      }
    >
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
      <p className="mb-2 text-xs font-medium text-amber-900/90">{guide.deviceDescription}</p>
      <p className="mb-2">{guide.intro}</p>
      <ol className="list-decimal space-y-1 pl-5">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {guide.footnote && <p className="mt-3 text-xs text-slate-600">{guide.footnote}</p>}
    </section>
  );
}
