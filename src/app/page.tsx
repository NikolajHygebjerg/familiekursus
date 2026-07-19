"use client";

import { useEffect, useState } from "react";
import { useFamily } from "@/context/FamilyContext";
import { useAuth } from "@/context/AuthContext";
import { familiekursusBilledeUrl } from "@/lib/blob-config";
import { BilleduploadFilePicker } from "@/components/BilleduploadFilePicker";
import { compressImageIfNeeded, MAX_UPLOAD_BYTES, validateBilleduploadFile } from "@/lib/image-upload";

interface WorkshopCount {
  name: string;
  count: number;
}

interface WorkshopParticipantDetail {
  navn: string;
  alder: string | null;
  type: string | null;
}

interface WorkshopFamilyGroup {
  email: string;
  familie: string | null;
  members: WorkshopParticipantDetail[];
}

interface WorkshopBackendInfo {
  underviser: string | null;
  hjaelpere: string | null;
  lokale: string | null;
}

const WORKSHOP_LABELS: Record<string, string> = {
  workshop1: "Workshop 1",
  workshop2: "Workshop 2",
  workshop3: "Workshop 3",
  workshop4: "Workshop 4",
  voksen: "Workshop Forældre (Voksen)",
  aftengrupper: "Aftengrupper",
  gyserløb: "Gyserløb",
  sheltertur: "Sheltertur",
  forhaandstilmelding: "Forhåndstilmeldinger",
  billedupload: "Billedupload",
};

const WORKSHOP_TABS = [
  "workshop1",
  "workshop2",
  "workshop3",
  "workshop4",
  "voksen",
  "aftengrupper",
  "gyserløb",
  "sheltertur",
  "forhaandstilmelding",
  "billedupload",
] as const;

const ACTIVITY_TABS = new Set(["aftengrupper", "gyserløb", "sheltertur"]);

interface ForhaandstilmeldingEntry {
  id: string;
  email: string;
  navn: string;
  antalVoksne: number;
  antalBorn: number;
}

interface ForhaandstilmeldingSummary {
  families: number;
  voksne: number;
  born: number;
  total: number;
}

interface BilleduploadFile {
  pathname: string;
  url?: string;
  filename: string;
  email: string;
  uploadedAt: string;
  size: number;
}

interface BilleduploadGroup {
  email: string;
  familie: string | null;
  files: BilleduploadFile[];
}

interface BilleduploadSummary {
  families: number;
  images: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleString("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AntalPage() {
  const { isKursusleder } = useFamily();
  const { email } = useAuth();
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>("workshop1");
  const [data, setData] = useState<WorkshopCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [participantFamilies, setParticipantFamilies] = useState<WorkshopFamilyGroup[]>([]);
  const [workshopBackend, setWorkshopBackend] = useState<WorkshopBackendInfo | null>(null);
  const [myRoles, setMyRoles] = useState<("underviser" | "hjaelper" | "alle")[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [forhaandstilmeldinger, setForhaandstilmeldinger] = useState<ForhaandstilmeldingEntry[]>([]);
  const [forhaandSummary, setForhaandSummary] = useState<ForhaandstilmeldingSummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [billeduploadGroups, setBilleduploadGroups] = useState<BilleduploadGroup[]>([]);
  const [billeduploadSummary, setBilleduploadSummary] = useState<BilleduploadSummary | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipMessage, setZipMessage] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [adminUploadFiles, setAdminUploadFiles] = useState<File[]>([]);
  const [adminUploadTargetEmail, setAdminUploadTargetEmail] = useState("");
  const [adminUploading, setAdminUploading] = useState(false);
  const [adminUploadError, setAdminUploadError] = useState<string | null>(null);
  const [adminUploadSuccess, setAdminUploadSuccess] = useState<string | null>(null);

  function loadBilledupload() {
    if (!isKursusleder || !email) return;
    setLoading(true);
    setError(null);
    fetch(`/api/billedupload?list=1&email=${encodeURIComponent(email)}`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body.error || res.statusText);
          });
        }
        return res.json();
      })
      .then((body: { groups: BilleduploadGroup[]; summary: BilleduploadSummary }) => {
        setBilleduploadGroups(body.groups ?? []);
        setBilleduploadSummary(body.summary ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Fejl"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSelectedOption(null);
    setParticipantFamilies([]);
    setWorkshopBackend(null);
    setMyRoles([]);
    setParticipantError(null);
    setForhaandstilmeldinger([]);
    setForhaandSummary(null);
    setExportMessage(null);
    setExportError(null);
    setBilleduploadGroups([]);
    setBilleduploadSummary(null);
    setZipMessage(null);
    setZipError(null);

    if (selectedWorkshop === "billedupload") {
      if (!isKursusleder || !email) {
        setLoading(false);
        return;
      }
      loadBilledupload();
      return;
    }

    if (selectedWorkshop === "forhaandstilmelding") {
      if (!isKursusleder || !email) {
        setLoading(false);
        return;
      }
      fetch(`/api/forhaandstilmelding?list=1&email=${encodeURIComponent(email)}`)
        .then((res) => {
          if (!res.ok) {
            return res.json().then((body) => {
              throw new Error(body.error || res.statusText);
            });
          }
          return res.json();
        })
        .then((body: { entries: ForhaandstilmeldingEntry[]; summary: ForhaandstilmeldingSummary }) => {
          setForhaandstilmeldinger(body.entries ?? []);
          setForhaandSummary(body.summary ?? null);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
      return;
    }

    fetch(`/api/workshops?workshop=${selectedWorkshop}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedWorkshop, isKursusleder, email]);

  async function handleExportForhaandstilmelding() {
    if (!email) return;
    setExporting(true);
    setExportMessage(null);
    setExportError(null);
    try {
      const res = await fetch("/api/forhaandstilmelding/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Eksport fejlede");
      }
      const blob = await res.blob();
      const dateLabel = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `forhaandstilmeldinger-${dateLabel}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setExportMessage(`Excel-ark downloadet (${forhaandstilmeldinger.length} forhåndstilmeldinger).`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Eksport fejlede");
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadBilleduploadZip() {
    if (!email) return;
    setDownloadingZip(true);
    setZipMessage(null);
    setZipError(null);
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
      setZipMessage("ZIP-fil downloadet.");
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Download fejlede");
    } finally {
      setDownloadingZip(false);
    }
  }

  async function handleAdminBilledupload() {
    if (!email || adminUploadFiles.length === 0) {
      setAdminUploadError("Vælg mindst ét billede");
      return;
    }

    setAdminUploading(true);
    setAdminUploadError(null);
    setAdminUploadSuccess(null);

    try {
      let uploaded = 0;
      for (const file of adminUploadFiles) {
        const validationError = validateBilleduploadFile(file);
        if (validationError) throw new Error(validationError);

        const prepared = await compressImageIfNeeded(file);
        if (prepared.size > MAX_UPLOAD_BYTES) {
          throw new Error(`${file.name} er for stort (max 4,5 MB)`);
        }
        const formData = new FormData();
        formData.append("email", email);
        formData.append("file", prepared);
        if (adminUploadTargetEmail.trim()) {
          formData.append("targetEmail", adminUploadTargetEmail.trim().toLowerCase());
        }
        const res = await fetch("/api/billedupload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Kunne ikke uploade ${file.name}`);
        uploaded += 1;
      }
      setAdminUploadSuccess(
        uploaded === 1 ? "1 billede uploadet." : `${uploaded} billeder uploadet.`
      );
      setAdminUploadFiles([]);
      loadBilledupload();
    } catch (err) {
      setAdminUploadError(err instanceof Error ? err.message : "Upload fejlede");
    } finally {
      setAdminUploading(false);
    }
  }

  function loadParticipants(optionName: string) {
    if (!isKursusleder || !email) return;
    setSelectedOption(optionName);
    setLoadingParticipants(true);
    setParticipantError(null);
    setParticipantFamilies([]);
    setWorkshopBackend(null);
    setMyRoles([]);

    fetch(
      `/api/workshops?workshop=${selectedWorkshop}&option=${encodeURIComponent(optionName)}&email=${encodeURIComponent(email)}`
    )
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body.error || res.statusText);
          });
        }
        return res.json();
      })
      .then(
        (body: {
          families: WorkshopFamilyGroup[];
          backend: WorkshopBackendInfo | null;
          roles?: ("underviser" | "hjaelper" | "alle")[];
        }) => {
        setParticipantFamilies(body.families ?? []);
        setWorkshopBackend(body.backend ?? null);
        setMyRoles(body.roles ?? []);
      }
      )
      .catch((err) => setParticipantError(err.message))
      .finally(() => setLoadingParticipants(false));
  }

  const totalParticipants = data.reduce((sum, w) => sum + w.count, 0);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Workshops</h1>
          <p className="mt-1 text-slate-600">Antal tilmeldte pr. workshop-valg.</p>
          {isKursusleder && (
            <p className="mt-2 text-sm text-amber-700">
              Tryk på en workshop, aftengruppe, gyserløb eller sheltertur for at se deltagere grupperet efter familie.
            </p>
          )}
        </header>

        <nav className="mb-6 flex flex-wrap gap-2">
          {WORKSHOP_TABS.map((key) => (
              <button
                key={key}
                onClick={() => setSelectedWorkshop(key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  selectedWorkshop === key
                    ? "bg-amber-500 text-white shadow-md"
                    : "bg-white text-slate-600 shadow-sm hover:bg-slate-100"
                }`}
              >
                {WORKSHOP_LABELS[key]}
              </button>
            ))}
        </nav>

        <section className="rounded-xl bg-white p-6 shadow-lg">
          <h2 className="mb-6 text-xl font-semibold text-slate-800">
            {WORKSHOP_LABELS[selectedWorkshop]}
          </h2>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-700">
              <p className="font-medium">Fejl ved hentning af data</p>
              <p className="mt-1 text-sm">{error}</p>
              <p className="mt-2 text-sm">
                Tjek at AIRTABLE_API_KEY er sat i miljøvariabler.
              </p>
            </div>
          )}

          {loading && !error && (
            <div className="flex items-center gap-2 text-slate-500">
              <svg
                className="h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Henter data...
            </div>
          )}

          {!loading && !error && selectedWorkshop === "forhaandstilmelding" && (
            <>
              {forhaandSummary && (
                <div className="mb-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-amber-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Familier</p>
                    <p className="text-2xl font-bold text-amber-600">{forhaandSummary.families}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Voksne</p>
                    <p className="text-2xl font-bold text-slate-800">{forhaandSummary.voksne}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Børn</p>
                    <p className="text-2xl font-bold text-slate-800">{forhaandSummary.born}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase text-slate-500">I alt</p>
                    <p className="text-2xl font-bold text-slate-800">{forhaandSummary.total}</p>
                  </div>
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleExportForhaandstilmelding()}
                  disabled={exporting || forhaandstilmeldinger.length === 0}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {exporting ? "Downloader..." : "Download Excel"}
                </button>
                <p className="text-sm text-slate-500">
                  Download Excel-ark med navn, email, antal voksne og børn.
                </p>
              </div>

              {exportMessage && (
                <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  {exportMessage}
                </div>
              )}
              {exportError && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {exportError}
                </div>
              )}

              {forhaandstilmeldinger.length === 0 ? (
                <p className="text-slate-500">Ingen forhåndstilmeldinger endnu.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-4 font-medium">Navn</th>
                        <th className="py-2 pr-4 font-medium">Email</th>
                        <th className="py-2 pr-4 font-medium">Voksne</th>
                        <th className="py-2 pr-4 font-medium">Børn</th>
                        <th className="py-2 font-medium">I alt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {forhaandstilmeldinger.map((entry) => (
                        <tr key={entry.id}>
                          <td className="py-3 pr-4 font-medium text-slate-800">{entry.navn}</td>
                          <td className="py-3 pr-4 text-slate-600">{entry.email}</td>
                          <td className="py-3 pr-4 text-slate-700">{entry.antalVoksne}</td>
                          <td className="py-3 pr-4 text-slate-700">{entry.antalBorn}</td>
                          <td className="py-3 font-semibold text-slate-800">
                            {entry.antalVoksne + entry.antalBorn}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!loading && !error && selectedWorkshop === "billedupload" && (
            <>
              {billeduploadSummary && (
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-amber-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Familier</p>
                    <p className="text-2xl font-bold text-amber-600">{billeduploadSummary.families}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase text-slate-500">Billeder</p>
                    <p className="text-2xl font-bold text-slate-800">{billeduploadSummary.images}</p>
                  </div>
                </div>
              )}

              <div className="mb-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleDownloadBilleduploadZip()}
                  disabled={downloadingZip || billeduploadGroups.length === 0}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {downloadingZip ? "Pakker..." : "Download alle (ZIP)"}
                </button>
                <p className="text-sm text-slate-500">
                  Download alle uploadede billeder grupperet efter familie (tilgængeligt for alle
                  tilmeldte).
                </p>
              </div>

              {zipMessage && (
                <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  {zipMessage}
                </div>
              )}
              {zipError && (
                <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{zipError}</div>
              )}

              <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="font-semibold text-slate-800">Upload billeder</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Upload på vegne af en familie ved at angive deres email. Lad feltet stå tomt for at
                  gemme under din egen konto.
                </p>
                <form
                  className="mt-4 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleAdminBilledupload();
                  }}
                >
                  <div>
                    <label
                      htmlFor="admin-upload-target-email"
                      className="mb-1 block text-sm font-medium text-slate-700"
                    >
                      Familie-email (valgfri)
                    </label>
                    <input
                      id="admin-upload-target-email"
                      type="email"
                      value={adminUploadTargetEmail}
                      onChange={(e) => setAdminUploadTargetEmail(e.target.value)}
                      placeholder="fx familie@example.dk"
                      className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                  <BilleduploadFilePicker
                    id="admin-upload-files"
                    files={adminUploadFiles}
                    onChange={setAdminUploadFiles}
                    disabled={adminUploading}
                    helperText="Kun billeder — videoer accepteres ikke. Max 4,5 MB pr. billede."
                  />
                  {adminUploadError && (
                    <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                      {adminUploadError}
                    </div>
                  )}
                  {adminUploadSuccess && (
                    <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                      {adminUploadSuccess}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={adminUploading}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {adminUploading ? "Uploader..." : "Upload billeder"}
                  </button>
                </form>
              </section>

              {billeduploadGroups.length === 0 ? (
                <p className="text-slate-500">Ingen billeder uploadet endnu.</p>
              ) : (
                <div className="space-y-8">
                  {billeduploadGroups.map((group) => (
                    <div key={group.email}>
                      <div className="mb-3">
                        <h3 className="font-semibold text-slate-800">
                          {group.familie || group.email}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {group.email} · {group.files.length}{" "}
                          {group.files.length === 1 ? "billede" : "billeder"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {group.files.map((file) => (
                          <div
                            key={file.pathname}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                          >
                            <a
                              href={familiekursusBilledeUrl(file.pathname, email!, false, file.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block aspect-square bg-slate-200"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={familiekursusBilledeUrl(file.pathname, email!, false, file.url)}
                                alt={file.filename}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </a>
                            <div className="space-y-2 p-2">
                              <p className="truncate text-xs text-slate-600" title={file.filename}>
                                {file.filename}
                              </p>
                              <p className="text-xs text-slate-400">
                                {formatUploadDate(file.uploadedAt)} · {formatBytes(file.size)}
                              </p>
                              <a
                                href={familiekursusBilledeUrl(file.pathname, email!, true, file.url)}
                                className="inline-block text-xs font-medium text-amber-700 hover:underline"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading &&
            !error &&
            selectedWorkshop !== "forhaandstilmelding" &&
            selectedWorkshop !== "billedupload" &&
            data.length === 0 && (
            <p className="text-slate-500">
              {selectedWorkshop === "aftengrupper"
                ? "Ingen tilmeldinger fundet til aftengrupper."
                : selectedWorkshop === "gyserløb"
                  ? "Ingen tilmeldinger fundet til gyserløb."
                  : selectedWorkshop === "sheltertur"
                    ? "Ingen tilmeldinger fundet til sheltertur."
                    : "Ingen tilmeldinger fundet for denne workshop."}
            </p>
          )}

          {!loading &&
            !error &&
            selectedWorkshop !== "forhaandstilmelding" &&
            selectedWorkshop !== "billedupload" &&
            data.length > 0 && (
            <>
              <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2">
                <span className="font-medium text-slate-700">I alt tilmeldte</span>
                <span className="text-2xl font-bold text-amber-600">{totalParticipants}</span>
              </div>

              <ul className="divide-y divide-slate-100">
                {data.map((workshop) => {
                  const isSelected = selectedOption === workshop.name;
                  const RowTag = isKursusleder ? "button" : "div";
                  return (
                    <li key={workshop.name}>
                      <RowTag
                        type={isKursusleder ? "button" : undefined}
                        onClick={isKursusleder ? () => loadParticipants(workshop.name) : undefined}
                        className={`flex w-full items-center justify-between py-3 text-left first:pt-0 ${
                          isKursusleder
                            ? `cursor-pointer rounded-lg px-2 transition-colors hover:bg-amber-50 ${
                                isSelected ? "bg-amber-50 ring-1 ring-amber-200" : ""
                              }`
                            : ""
                        }`}
                      >
                        <span className="font-medium text-slate-800">{workshop.name}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                          {workshop.count}
                        </span>
                      </RowTag>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {isKursusleder && selectedOption && (
          <section className="mt-6 rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Deltagere</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedOption} · {WORKSHOP_LABELS[selectedWorkshop]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedOption(null);
                  setParticipantFamilies([]);
                  setWorkshopBackend(null);
                  setMyRoles([]);
                  setParticipantError(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Luk
              </button>
            </div>

            {!loadingParticipants && !participantError && !ACTIVITY_TABS.has(selectedWorkshop) && myRoles.length > 0 && (
              <p className="mb-4 text-sm font-medium text-amber-700">
                Din rolle:{" "}
                {myRoles.includes("alle")
                  ? "Alle (fælles workshop)"
                  : myRoles
                      .map((role) => (role === "underviser" ? "Underviser" : "Hjælper"))
                      .join(" · ")}
              </p>
            )}

            {!loadingParticipants && !participantError && !ACTIVITY_TABS.has(selectedWorkshop) && (
              <dl className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Underviser
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {workshopBackend?.underviser || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Hjælpere
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {workshopBackend?.hjaelpere || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Lokale
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">
                    {workshopBackend?.lokale || "—"}
                  </dd>
                </div>
              </dl>
            )}

            {loadingParticipants && (
              <p className="text-slate-500">Henter deltagere...</p>
            )}

            {participantError && (
              <div className="rounded-lg bg-red-50 p-4 text-red-700">
                <p className="text-sm">{participantError}</p>
              </div>
            )}

            {!loadingParticipants && !participantError && participantFamilies.length === 0 && (
              <p className="text-slate-500">Ingen deltagere fundet.</p>
            )}

            {!loadingParticipants && !participantError && participantFamilies.length > 0 && (
              <div className="space-y-4">
                {participantFamilies.map((family) => (
                  <div
                    key={family.email}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="font-semibold text-slate-800">
                      {family.familie || family.email}
                    </p>
                    {family.familie && (
                      <p className="text-xs text-slate-500">{family.email}</p>
                    )}
                    <ul className="mt-2 space-y-1">
                      {family.members.map((member) => (
                        <li key={`${family.email}-${member.navn}`} className="text-sm text-slate-700">
                          • {member.navn}
                          {member.type ? ` (${member.type})` : ""}
                          {member.alder ? ` · ${member.alder}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
