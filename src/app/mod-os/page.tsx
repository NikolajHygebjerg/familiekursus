"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { MoedOsPersonView } from "@/lib/moed-os";

export default function MoedOsPage() {
  const { email, isAdmin, adminNavn } = useAuth();
  const [title, setTitle] = useState("");
  const [people, setPeople] = useState<MoedOsPersonView[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusBySlug, setStatusBySlug] = useState<Record<string, string>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [uploadingSlug, setUploadingSlug] = useState<string | null>(null);

  const loadPeople = useCallback(() => {
    setLoading(true);
    setError(null);
    const url = email
      ? `/api/moed-os?email=${encodeURIComponent(email)}`
      : "/api/moed-os";
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data) => {
        const list: MoedOsPersonView[] = Array.isArray(data?.people) ? data.people : [];
        setTitle(data?.title || "");
        setPeople(list);
        setIsSuperAdmin(Boolean(data?.isSuperAdmin));
        setUploadEnabled(Boolean(data?.uploadEnabled));
        setNameDrafts(
          Object.fromEntries(list.map((person) => [person.slug, person.name]))
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [email]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  async function handleUpload(slug: string, file: File) {
    if (!email) return;
    setUploadingSlug(slug);
    setStatusBySlug((prev) => ({ ...prev, [slug]: "" }));

    const formData = new FormData();
    formData.append("email", email);
    formData.append("slug", slug);
    formData.append("file", file);

    try {
      const res = await fetch("/api/moed-os/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setStatusBySlug((prev) => ({ ...prev, [slug]: "Billede opdateret" }));
      loadPeople();
    } catch (err) {
      setStatusBySlug((prev) => ({
        ...prev,
        [slug]: err instanceof Error ? err.message : "Upload fejlede",
      }));
    } finally {
      setUploadingSlug(null);
    }
  }

  async function handleNameSave(slug: string) {
    if (!email || !isSuperAdmin) return;
    const name = nameDrafts[slug]?.trim();
    if (!name) return;

    setStatusBySlug((prev) => ({ ...prev, [slug]: "" }));
    try {
      const res = await fetch("/api/moed-os", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, slug, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setStatusBySlug((prev) => ({ ...prev, [slug]: "Navn opdateret" }));
      loadPeople();
    } catch (err) {
      setStatusBySlug((prev) => ({
        ...prev,
        [slug]: err instanceof Error ? err.message : "Kunne ikke gemme navn",
      }));
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Mød os</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{title}</p>
        {isAdmin && !uploadEnabled && (
          <p className="mt-3 text-xs text-amber-700">
            Billede-upload kræver BLOB_READ_WRITE_TOKEN i Vercel. Navne kan stadig gemmes i Airtable.
          </p>
        )}
      </header>

      {loading && <p className="text-center text-slate-500">Henter...</p>}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {people.map((person) => (
            <li
              key={person.slug}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative aspect-square w-full bg-slate-100">
                <Image
                  src={person.image}
                  alt={person.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover object-top"
                  unoptimized={person.image.startsWith("http")}
                />
              </div>
              <div className="px-2 py-2.5">
                {person.canEditName ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={nameDrafts[person.slug] ?? person.name}
                      onChange={(e) =>
                        setNameDrafts((prev) => ({ ...prev, [person.slug]: e.target.value }))
                      }
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleNameSave(person.slug)}
                      className="w-full rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      Gem navn
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-sm font-semibold text-slate-800">{person.name}</p>
                )}

                {person.canEdit && uploadEnabled && (
                  <label className="mt-2 block">
                    <span className="sr-only">Upload nyt billede for {person.name}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={uploadingSlug === person.slug}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload(person.slug, file);
                        e.target.value = "";
                      }}
                      className="block w-full text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-amber-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-amber-900"
                    />
                  </label>
                )}

                {person.canEdit && !uploadEnabled && isAdmin && (
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    Upload afventer Vercel Blob-opsætning
                  </p>
                )}

                {statusBySlug[person.slug] && (
                  <p className="mt-1 text-center text-[11px] text-slate-500">
                    {statusBySlug[person.slug]}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && isSuperAdmin && (
        <p className="mt-6 text-center text-xs text-slate-500">
          Som super-admin kan du ændre navne og uploade billeder for alle.
        </p>
      )}

      {isAdmin && !isSuperAdmin && adminNavn && (
        <p className="mt-6 text-center text-xs text-slate-500">
          Du kan uploade billede for din egen profil (matcher «{adminNavn}» i Brugere-tabellen).
        </p>
      )}
    </main>
  );
}
