"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const WORKSHOP_LABELS: Record<string, string> = {
  workshop1: "Workshop 1",
  workshop2: "Workshop 2",
  workshop3: "Workshop 3",
  workshop4: "Workshop 4",
  voksen: "Forældreworkshop",
};

interface FamilyMember {
  navn: string;
  workshop1: string | null;
  workshop2: string | null;
  workshop3: string | null;
  workshop4: string | null;
  voksen: string | null;
  type?: string | null;
}

export default function WorkshopTilmeldingPage() {
  const router = useRouter();
  const { email, setAuth } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [options, setOptions] = useState<Record<string, string[]>>({
    workshop1: [],
    workshop2: [],
    workshop3: [],
    workshop4: [],
    voksen: [],
  });
  const [navn, setNavn] = useState("");
  const [type, setType] = useState<"Voksen" | "Barn">("Voksen");
  const [workshop1, setWorkshop1] = useState("");
  const [workshop2, setWorkshop2] = useState("");
  const [workshop3, setWorkshop3] = useState("");
  const [workshop4, setWorkshop4] = useState("");
  const [voksen, setVoksen] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sessionVoksne, setSessionVoksne] = useState<FamilyMember[]>([]);

  const fetchMembers = useCallback(() => {
    if (!email) return;
    fetch(`/api/families/email?email=${encodeURIComponent(email)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [email]);

  useEffect(() => {
    if (!email) {
      router.replace("/login");
      return;
    }
    Promise.all([
      fetch(`/api/workshop-options?year=${new Date().getFullYear()}`).then((res) => (res.ok ? res.json() : {})),
      fetch(`/api/families/email?email=${encodeURIComponent(email)}`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([opts, mems]) => {
        setOptions(opts);
        setMembers(mems);
      })
      .catch(() => setLoading(false))
      .finally(() => setLoading(false));
  }, [email, router]);

  const voksneFraApi = members.filter(
    (m) =>
      m.type?.toLowerCase() === "voksen" ||
      m.voksen ||
      m.workshop1 ||
      m.workshop2 ||
      m.workshop3 ||
      m.workshop4
  );
  const voksne = [...sessionVoksne];
  for (const m of voksneFraApi) {
    if (!voksne.some((v) => v.navn === m.navn)) voksne.push(m);
  }

  const resetForm = useCallback(() => {
    setNavn("");
    setType("Voksen");
    setWorkshop1("");
    setWorkshop2("");
    setWorkshop3("");
    setWorkshop4("");
    setVoksen("");
    setError(null);
  }, []);

  const submit = useCallback(
    async (andFinish: boolean) => {
      if (!email || !navn.trim()) {
        setError("Udfyld navn");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/workshop-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            navn: navn.trim(),
            type,
            workshop1: workshop1 || undefined,
            workshop2: workshop2 || undefined,
            workshop3: workshop3 || undefined,
            workshop4: workshop4 || undefined,
            voksen: voksen || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fejl ved tilmelding");
        if (andFinish) {
          setAuth(email, null, false);
          setDone(true);
        } else {
          if (type === "Voksen" && (workshop1 || workshop2 || workshop3 || workshop4 || voksen)) {
            setSessionVoksne((prev) => [
              ...prev,
              {
                navn: navn.trim(),
                workshop1: workshop1 || null,
                workshop2: workshop2 || null,
                workshop3: workshop3 || null,
                workshop4: workshop4 || null,
                voksen: voksen || null,
              },
            ]);
          }
          resetForm();
          fetchMembers();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fejl");
      } finally {
        setSubmitting(false);
      }
    },
    [email, navn, type, workshop1, workshop2, workshop3, workshop4, voksen, setAuth, resetForm, fetchMembers]
  );

  if (!email) return null;

  if (done) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="max-w-md rounded-xl bg-white p-8 shadow-lg">
          <h1 className="mb-4 text-center text-2xl font-bold text-slate-800">
            Tak for tilmeldingen
          </h1>
          <p className="text-center text-slate-600">
            I får besked når I kan se jeres workshopvalg her på siden.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 w-full rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600"
          >
            Gå til appen
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 pb-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-800">
          Tilmeld workshops
        </h1>
        <p className="mb-6 text-slate-600">
          Udfyld formularen for hvert familiemedlem. Email ({email}) tilføjes automatisk.
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Henter workshops...
          </div>
        )}

        {!loading && (
          <form
            onSubmit={(e) => e.preventDefault()}
            className="space-y-6 rounded-xl bg-white p-6 shadow-lg"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Navn</label>
              <input
                type="text"
                value={navn}
                onChange={(e) => setNavn(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                placeholder="Fulde navn"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Vælg</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    checked={type === "Voksen"}
                    onChange={() => setType("Voksen")}
                  />
                  Voksen
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    checked={type === "Barn"}
                    onChange={() => {
                      setType("Barn");
                      setVoksen("");
                      fetchMembers();
                    }}
                  />
                  Barn
                </label>
              </div>
            </div>

            {type === "Barn" && voksne.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Hurtigvalg</p>
                <div className="flex flex-wrap gap-2">
                  {voksne.map((voksenPerson) => (
                    <button
                      key={voksenPerson.navn}
                      type="button"
                      onClick={() => {
                        setWorkshop1(voksenPerson.workshop1 || "");
                        setWorkshop2(voksenPerson.workshop2 || "");
                        setWorkshop3(voksenPerson.workshop3 || "");
                        setWorkshop4(voksenPerson.workshop4 || "");
                      }}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                    >
                      Vælg samme workshops som {voksenPerson.navn}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(["workshop1", "workshop2", "workshop3", "workshop4", "voksen"] as const)
              .filter((key) => key !== "voksen" || type === "Voksen")
              .map((key) => (
              <div key={key}>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {WORKSHOP_LABELS[key]}
                </label>
                <select
                  value={
                    key === "workshop1" ? workshop1
                    : key === "workshop2" ? workshop2
                    : key === "workshop3" ? workshop3
                    : key === "workshop4" ? workshop4
                    : voksen
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (key === "workshop1") setWorkshop1(v);
                    else if (key === "workshop2") setWorkshop2(v);
                    else if (key === "workshop3") setWorkshop3(v);
                    else if (key === "workshop4") setWorkshop4(v);
                    else setVoksen(v);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="">Vælg...</option>
                  {(options[key] || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}

            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={submitting || !navn.trim()}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                Tilmeld og tilføj person
              </button>
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={submitting || !navn.trim()}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                Tilmeld og afslut
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
