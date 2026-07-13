"use client";

import { useEffect, useState } from "react";
import { canCast, castSong } from "@/lib/cast/sender";

function CastIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M1 18v3h3c0-4.97 4.03-9 9-9s9 4.03 9 9h3v-3c0-6.63-5.37-12-12-12S1 11.37 1 18zm8.5 0c0-2.48 2.02-4.5 4.5-4.5s4.5 2.02 4.5 4.5H9.5zM20 6.5 17.5 9 20 11.5V6.5zM4 6.5v5l2.5-2.5L4 6.5z" />
    </svg>
  );
}

export default function CastSongButton({
  songId,
  label = "Cast sang",
  className = "",
}: {
  songId: string;
  label?: string;
  className?: string;
}) {
  const [available, setAvailable] = useState(false);
  const [casting, setCasting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvailable(canCast());
  }, []);

  if (!available) return null;

  async function handleCast() {
    setCasting(true);
    setError(null);
    try {
      const result = await castSong(songId);
      if (result === "failed") {
        setError("Kunne ikke caste sangen");
      }
    } catch {
      setError("Kunne ikke caste sangen");
    } finally {
      setCasting(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleCast()}
        disabled={casting}
        aria-label={label}
        title={label}
        className="inline-flex items-center gap-1.5 rounded-lg p-1.5 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900 disabled:opacity-50"
      >
        <CastIcon />
        <span className="sr-only">{label}</span>
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
