"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const EVALUERING_FORM_URL = "https://forms.cloud.microsoft/e/sFVNEvzDHC";
const EVALUERING_EMBED_URL = `${EVALUERING_FORM_URL}?embed=true`;

const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

type Tab = "evaluering" | "forhaandstilmelding" | "billedupload";

async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES || !file.type.startsWith("image/")) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxSide = 2200;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(
            new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Kunne ikke behandle billedet"));
    };
    img.src = url;
  });
}

export default function EvalueringPage() {
  const { email, familyName } = useAuth();
  const [tab, setTab] = useState<Tab>("evaluering");
  const [antalVoksne, setAntalVoksne] = useState("1");
  const [antalBorn, setAntalBorn] = useState("0");
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!email || tab !== "forhaandstilmelding") return;
    setLoadingExisting(true);
    fetch(`/api/forhaandstilmelding?email=${encodeURIComponent(email)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.entry) {
          setAntalVoksne(String(data.entry.antalVoksne));
          setAntalBorn(String(data.entry.antalBorn));
          setHasExisting(true);
        } else {
          setHasExisting(false);
        }
      })
      .catch(() => setHasExisting(false))
      .finally(() => setLoadingExisting(false));
  }, [email, tab]);

  const handleSubmit = useCallback(async () => {
    if (!email) return;
    const voksne = parseInt(antalVoksne, 10);
    const born = parseInt(antalBorn, 10);
    if (isNaN(voksne) || voksne < 0 || isNaN(born) || born < 0) {
      setError("Angiv gyldige tal for voksne og børn");
      return;
    }
    if (voksne + born < 1) {
      setError("Angiv mindst én voksen eller ét barn");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/forhaandstilmelding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, antalVoksne: voksne, antalBorn: born }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fejl ved forhåndstilmelding");
      setHasExisting(true);
      setSuccess(hasExisting ? "Forhåndstilmelding opdateret!" : "Tak for jeres forhåndstilmelding!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl ved forhåndstilmelding");
    } finally {
      setLoading(false);
    }
  }, [email, antalVoksne, antalBorn, hasExisting]);

  const handleBilledupload = useCallback(async () => {
    if (!email || !uploadFiles || uploadFiles.length === 0) {
      setUploadError("Vælg mindst ét billede");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      let uploaded = 0;
      for (const file of Array.from(uploadFiles)) {
        const prepared = await compressImageIfNeeded(file);
        if (prepared.size > MAX_UPLOAD_BYTES) {
          throw new Error(`${file.name} er for stort (max 4,5 MB)`);
        }
        const formData = new FormData();
        formData.append("email", email);
        formData.append("file", prepared);
        const res = await fetch("/api/billedupload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Kunne ikke uploade ${file.name}`);
        uploaded += 1;
      }
      setUploadSuccess(
        uploaded === 1 ? "1 billede uploadet. Tak!" : `${uploaded} billeder uploadet. Tak!`
      );
      setUploadFiles(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload fejlede");
    } finally {
      setUploading(false);
    }
  }, [email, uploadFiles]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col px-4 py-6 pb-24">
      <header className="mb-4 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Evaluering</h1>
      </header>

      <div className="mb-6 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("evaluering")}
          className={`flex-1 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
            tab === "evaluering"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Evaluering
        </button>
        <button
          type="button"
          onClick={() => setTab("forhaandstilmelding")}
          className={`flex-1 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
            tab === "forhaandstilmelding"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Forhåndstilmelding
        </button>
        <button
          type="button"
          onClick={() => setTab("billedupload")}
          className={`flex-1 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
            tab === "billedupload"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          Billedupload
        </button>
      </div>

      {tab === "evaluering" && (
        <>
          <p className="mb-4 text-center text-sm leading-relaxed text-slate-600">
            Vi håber I vil udfylde evalueringen af familiekursus 2026. Har I ikke deltaget i et
            programpunkt, springer I bare over spørgsmålet.
          </p>
          <a
            href={EVALUERING_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-4 block text-center text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline"
          >
            Åbn evalueringsskema i ny fane
          </a>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <iframe
              src={EVALUERING_EMBED_URL}
              title="Evalueringsskema – Familiekursus 2026"
              className="h-[75vh] min-h-[32rem] w-full border-0"
              loading="lazy"
            />
          </div>
        </>
      )}

      {tab === "forhaandstilmelding" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Forhåndstilmelding</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Forhåndstilmeld jeres familie til næste års familiekursus. Angiv hvor mange voksne og
            børn I forventer at tilmelde.
          </p>
          {familyName && familyName !== "Kursusleder" && (
            <p className="mt-2 text-sm text-slate-500">Familie: {familyName}</p>
          )}

          {loadingExisting ? (
            <p className="mt-6 text-sm text-slate-500">Henter jeres tilmelding...</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="antal-voksne" className="mb-1 block text-sm font-medium text-slate-700">
                    Antal voksne
                  </label>
                  <input
                    id="antal-voksne"
                    type="number"
                    min={0}
                    value={antalVoksne}
                    onChange={(e) => setAntalVoksne(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="antal-born" className="mb-1 block text-sm font-medium text-slate-700">
                    Antal børn
                  </label>
                  <input
                    id="antal-born"
                    type="number"
                    min={0}
                    value={antalBorn}
                    onChange={(e) => setAntalBorn(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              )}
              {success && (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {loading
                  ? "Gemmer..."
                  : hasExisting
                    ? "Opdater forhåndstilmelding"
                    : "Forhåndstilmeld"}
              </button>
            </form>
          )}
        </section>
      )}

      {tab === "billedupload" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Billedupload</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Upload billeder fra familiekursus her. I er allerede logget ind i appen — det kræver ikke
            Microsoft-login. Billederne gemmes sikkert og kan hentes af kursusledelsen.
          </p>
          {familyName && familyName !== "Kursusleder" && (
            <p className="mt-2 text-sm text-slate-500">Familie: {familyName}</p>
          )}

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleBilledupload();
            }}
          >
            <div>
              <label htmlFor="billedupload-files" className="mb-1 block text-sm font-medium text-slate-700">
                Vælg billeder
              </label>
              <input
                id="billedupload-files"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => setUploadFiles(e.target.files)}
                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-amber-800 hover:file:bg-amber-200"
              />
              <p className="mt-2 text-xs text-slate-500">
                JPG, PNG, WebP eller GIF. Store billeder komprimeres automatisk (max 4,5 MB).
              </p>
            </div>

            {uploadError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{uploadError}</div>
            )}
            {uploadSuccess && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                {uploadSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !email || !uploadFiles?.length}
              className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {uploading ? "Uploader..." : "Upload billeder"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
