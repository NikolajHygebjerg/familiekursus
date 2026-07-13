"use client";

import { useState } from "react";
import {
  castSong,
  copyTvDisplayLink,
  openTvDisplay,
  shareTvDisplay,
  shouldUseTvFallback,
  supportsNativeCast,
} from "@/lib/cast/sender";

function CastIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M1 18v3h3c0-4.97 4.03-9 9-9s9 4.03 9 9h3v-3c0-6.63-5.37-12-12-12S1 11.37 1 18zm8.5 0c0-2.48 2.02-4.5 4.5-4.5s4.5 2.02 4.5 4.5H9.5zM20 6.5 17.5 9 20 11.5V6.5zM4 6.5v5l2.5-2.5L4 6.5z" />
    </svg>
  );
}

export default function CastSongButton({
  songId,
  title,
  label = "Vis på TV",
  className = "",
}: {
  songId: string;
  title: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [casting, setCasting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleOpen() {
    setMessage(null);

    if (!shouldUseTvFallback()) {
      setCasting(true);
      try {
        const result = await castSong(songId);
        if (result !== "failed") return;
      } catch {
        // Show fallback sheet below.
      } finally {
        setCasting(false);
      }
    }

    setOpen(true);
  }

  async function handleShare() {
    setMessage(null);
    const shared = await shareTvDisplay(songId, title);
    setMessage(shared ? "Link delt eller kopieret." : "Kunne ikke dele linket.");
  }

  async function handleCopy() {
    setMessage(null);
    const copied = await copyTvDisplayLink(songId);
    setMessage(copied ? "Link kopieret." : "Kunne ikke kopiere linket.");
  }

  function handleOpenDisplay() {
    openTvDisplay(songId);
    setOpen(false);
  }

  return (
    <>
      <div className={className}>
        <button
          type="button"
          onClick={() => void handleOpen()}
          disabled={casting}
          aria-label={label}
          title={label}
          className="inline-flex items-center gap-1.5 rounded-lg p-1.5 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900 disabled:opacity-50"
        >
          <CastIcon />
          <span className="sr-only">{label}</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl">
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Vis på TV</h2>
                  <p className="mt-1 text-sm text-slate-600">{title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                >
                  Luk
                </button>
              </div>

              <p className="mb-4 text-sm text-slate-600">
                {supportsNativeCast()
                  ? "Vælg en måde at vise sangen på."
                  : "Chromecast virker ikke direkte i iPhone-browseren. Brug en af mulighederne herunder."}
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleOpenDisplay}
                  className="w-full rounded-xl bg-amber-500 px-4 py-3 text-left text-sm font-medium text-white hover:bg-amber-600"
                >
                  Åbn TV-visning
                  <span className="mt-1 block text-xs font-normal text-amber-50">
                    Åbn sangen i fuld skærm og brug AirPlay til at spejle til TV.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Del link
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Send linket til TV&apos;ens browser eller en anden enhed.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Kopiér link
                </button>
              </div>

              {message && (
                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
