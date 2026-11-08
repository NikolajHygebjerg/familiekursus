import { getFamilyMembersByLogin, normalizeLoginName } from "@/lib/airtable";
import { getKursusYear } from "@/lib/kursus-year";
import { coerceFkFields, countFkRecordsByTableKey, fetchFkRecords } from "@/lib/fk-records";
import {
  createAdminClient,
  getSupabaseProjectRef,
  getSupabasePublicHost,
  isSupabaseConfigured,
} from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Offentlig sundhedstjek — ingen hemmeligheder (hjælper med at afstemme Vercel-env). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const login = normalizeLoginName(url.searchParams.get("login") ?? "");
  const debug = url.searchParams.get("debug") === "1";

  let tableKeyCounts: Record<string, number> = {};
  try {
    tableKeyCounts = await countFkRecordsByTableKey();
  } catch {
    tableKeyCounts = {};
  }
  const year = getKursusYear();
  const participantsTableKey = `participants_${year}`;
  const participantsRowCount = tableKeyCounts[participantsTableKey] ?? 0;

  let rosterCount: number | undefined;
  let rosterFromLegacyCount: number | undefined;
  if (login.length > 0) {
    rosterFromLegacyCount = (await getFamilyMembersByLogin(login)).length;
    rosterCount =
      participantsRowCount > 0 ? rosterFromLegacyCount : 0;
  }

  let fieldsDebug:
    | {
        sampleFieldsType: string;
        coercedNavnCount: number;
        fkRecordsCount: number;
        fkHyggeLoginFieldCount: number;
      }
    | undefined;
  if (debug) {
    try {
      const supabase = createAdminClient();
      const tableKey = `participants_${getKursusYear()}`;
      const { data } = await supabase.from("fk_records").select("fields").eq("table_key", tableKey).limit(20);
      const rows = data ?? [];
      let coercedNavnCount = 0;
      let fkHyggeLoginFieldCount = 0;
      const loginTarget = login.toLowerCase();
      for (const row of rows) {
        const fields = coerceFkFields(row.fields);
        const navn = fields.Navn ?? fields.navn ?? fields.Name;
        if (typeof navn === "string" && navn.trim()) coercedNavnCount += 1;
        for (const key of ["Brugernavn", "Email", "Familie", "email", "familie"] as const) {
          const v = fields[key];
          if (typeof v === "string" && normalizeLoginName(v).toLowerCase() === loginTarget) {
            fkHyggeLoginFieldCount += 1;
            break;
          }
        }
      }
      const viaFk = login.length > 0 ? await fetchFkRecords(String(getKursusYear())) : [];
      const sample = rows[0]?.fields;
      fieldsDebug = {
        sampleFieldsType: sample == null ? "null" : typeof sample,
        coercedNavnCount,
        fkRecordsCount: viaFk.length,
        fkHyggeLoginFieldCount,
      };
    } catch {
      fieldsDebug = {
        sampleFieldsType: "error",
        coercedNavnCount: 0,
        fkRecordsCount: 0,
        fkHyggeLoginFieldCount: 0,
      };
    }
  }

  const fkRecordsTotal = Object.values(tableKeyCounts).reduce((a, b) => a + b, 0);
  const deployRef = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const dataStaleWarning =
    participantsRowCount === 0 &&
    login.length > 0 &&
    (rosterFromLegacyCount ?? 0) > 0;

  return NextResponse.json({
    ok: true,
    kursusYear: year,
    supabaseConfigured: isSupabaseConfigured(),
    supabaseProjectRef: getSupabaseProjectRef(),
    participants2027RowCount: participantsRowCount,
    dataSource: {
      host: getSupabasePublicHost(),
      projectRef: getSupabaseProjectRef(),
      kursusYear: year,
      participantsTableKey,
      tableKeyCounts,
      fkRecordsTotal,
      checkedAt: new Date().toISOString(),
      vercelEnv: process.env.VERCEL_ENV ?? null,
      deployRef,
      dataStaleWarning,
      rosterFromLegacyCount: login.length > 0 ? rosterFromLegacyCount : undefined,
    },
    ...(fieldsDebug ? { fieldsDebug } : {}),
    ...(login.length > 0 ? { login, rosterMemberCount: rosterCount } : {}),
  });
}
