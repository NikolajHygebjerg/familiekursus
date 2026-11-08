import { getKursusYear } from "@/lib/kursus-year";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Offentlig sundhedstjek — ingen hemmeligheder (hjælper med at afstemme Vercel-env). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    kursusYear: getKursusYear(),
    supabaseConfigured: isSupabaseConfigured(),
  });
}
