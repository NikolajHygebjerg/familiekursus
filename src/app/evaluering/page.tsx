"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  BilleduploadGalleryGroups,
  type BilleduploadGalleryGroup,
} from "@/components/BilleduploadGallery";
import { BilleduploadFilePicker } from "@/components/BilleduploadFilePicker";
import {
  compressImageIfNeeded,
  MAX_UPLOAD_BYTES,
  validateBilleduploadFile,
} from "@/lib/image-upload";

const EVALUERING_FORM_URL = "https://forms.cloud.microsoft/e/sFVNEvzDHC";
const EVALUERING_EMBED_URL = `${EVALUERING_FORM_URL}?embed=true`;

type Tab = "evaluering" | "forhaandstilmelding" | "billedupload";

export default function EvalueringPage() {
  const { email, familyName, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("evaluering");
  const [antalVoksne, setAntalVoksne] = useState("1");
  const [antalBorn, setAntalBorn] = useState("0");
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadGroups, setUploadGroups] = useState<BilleduploadGalleryGroup[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [adminTargetEmail, setAdminTargetEmail] = useState("");

  const loadUploadedImages = useCallback(async () => {
    if (!email) return;
    setLoadingGallery(true);
    try {
      const res = await fetch(
        `/api/billedupload?list=1&email=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunne ikke hente billeder");
      setUploadGroups(data.groups ?? []);
    } catch {
      setUploadGroups([]);
    } finally {
      setLoadingGallery(false);
    }
  }, [email]);

  useEffect(() => {
    if (!email || tab !== "billedupload") return;
    void loadUploadedImages();
  }, [email, tab, loadUploadedImages]);

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
    if (!email || uploadFiles.length === 0) {
      setUploadError("Vælg mindst ét billede");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      let uploaded = 0;
      for (const file of uploadFiles) {
        const validationError = validateBilleduploadFile(file);
        if (validationError) throw new Error(validationError);

        const prepared = await compressImageIfNeeded(file);
        if (prepared.size > MAX_UPLOAD_BYTES) {
          throw new Error(`${file.name} er for stort (max 4,5 MB)`);
        }
        const formData = new FormData();
        formData.append("email", email);
        formData.append("file", prepared);
        if (isAdmin && adminTargetEmail.trim()) {
          formData.append("targetEmail", adminTargetEmail.trim().toLowerCase());
        }
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
      setUploadFiles([]);
      await loadUploadedImages();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload fejlede");
    } finally {
      setUploading(false);
    }
  }, [email, uploadFiles, isAdmin, adminTargetEmail, loadUploadedImages]);

  const handleDownloadZip = useCallback(async () => {
    if (!email) return;
    setDownloadingZip(true);
    try {
      const res = await fetch("/api/billedupload/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Download fejlede");
      }
      const blob = await res.blob();
      const dateLabel = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `familiekursus-billeder-${dateLabel}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Download fejlede");
    } finally {
      setDownloadingZip(false);
    }
  }, [email]);

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
            Upload billeder fra familiekursus her. Alle tilmeldte kan se og downloade alle uploadede
            billeder nedenfor.
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
            {isAdmin && (
              <div>
                <label
                  htmlFor="billedupload-target-email"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Familie-email (valgfri, kun admin)
                </label>
                <input
                  id="billedupload-target-email"
                  type="email"
                  value={adminTargetEmail}
                  onChange={(e) => setAdminTargetEmail(e.target.value)}
                  placeholder="Upload på vegne af en familie"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            )}

            <BilleduploadFilePicker
              id="billedupload-files"
              files={uploadFiles}
              onChange={setUploadFiles}
              disabled={uploading}
            />

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
              disabled={uploading || !email || uploadFiles.length === 0}
              className="w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {uploading ? "Uploader..." : "Upload billeder"}
            </button>
          </form>

          {loadingGallery ? (
            <p className="mt-8 text-sm text-slate-500">Henter billeder...</p>
          ) : (
            email && (
              <>
                {uploadGroups.length > 0 && (
                  <div className="mt-8 border-t border-slate-200 pt-6">
                    <button
                      type="button"
                      onClick={() => void handleDownloadZip()}
                      disabled={downloadingZip}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      {downloadingZip ? "Pakker..." : "Download alle (ZIP)"}
                    </button>
                  </div>
                )}
                <BilleduploadGalleryGroups groups={uploadGroups} viewerEmail={email} />
              </>
            )
          )}
        </section>
      )}
    </main>
  );
}
