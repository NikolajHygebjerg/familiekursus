import { getFamilyMembersByLogin, normalizeLoginName } from "@/lib/airtable";
import { getKursusYear } from "@/lib/kursus-year";
import { getSupabaseProjectRef, isSupabaseConfigured } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Offentlig sundhedstjek — ingen hemmeligheder (hjælper med at afstemme Vercel-env). */
export async function GET(request: Request) {
  const login = normalizeLoginName(new URL(request.url).searchParams.get("login") ?? "");
  const rosterCount =
    login.length > 0 ? (await getFamilyMembersByLogin(login)).length : undefined;

  return NextResponse.json({
    ok: true,
    kursusYear: getKursusYear(),
    supabaseConfigured: isSupabaseConfigured(),
    supabaseProjectRef: getSupabaseProjectRef(),
    ...(login.length > 0 ? { login, rosterMemberCount: rosterCount } : {}),
  });
}
