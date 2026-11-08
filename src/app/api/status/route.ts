import { getFamilyMembersByLogin, normalizeLoginName } from "@/lib/airtable";
import { getKursusYear } from "@/lib/kursus-year";
import {
  createAdminClient,
  getSupabaseProjectRef,
  isSupabaseConfigured,
} from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Offentlig sundhedstjek — ingen hemmeligheder (hjælper med at afstemme Vercel-env). */
export async function GET(request: Request) {
  const login = normalizeLoginName(new URL(request.url).searchParams.get("login") ?? "");
  const rosterCount =
    login.length > 0 ? (await getFamilyMembersByLogin(login)).length : undefined;

  let participants2027RowCount: number | null = null;
  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("fk_records")
      .select("*", { count: "exact", head: true })
      .eq("table_key", `participants_${getKursusYear()}`);
    if (!error && count != null) participants2027RowCount = count;
  } catch {
    participants2027RowCount = null;
  }

  return NextResponse.json({
    ok: true,
    kursusYear: getKursusYear(),
    supabaseConfigured: isSupabaseConfigured(),
    supabaseProjectRef: getSupabaseProjectRef(),
    participants2027RowCount,
    ...(login.length > 0 ? { login, rosterMemberCount: rosterCount } : {}),
  });
}
