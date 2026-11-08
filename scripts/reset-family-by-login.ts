/**
 * Slet alle deltager-rækker (participants_YYYY) for et familielogin i Supabase.
 * Beholder rækken i Brugere — login kan bruges til at starte forfra.
 *
 * Kør: npx tsx scripts/reset-family-by-login.ts Hygge
 */
import ws from "ws";
import { createClient } from "@supabase/supabase-js";
import { getKursusYear } from "../src/lib/kursus-year";

function normalizeLogin(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function recordMatchesLogin(fields: Record<string, unknown>, login: string): boolean {
  const target = normalizeLogin(login).toLowerCase();
  const candidates = ["Brugernavn", "Email", "Familie", "brugernavn", "email", "familie"];
  return candidates.some((key) => {
    const v = fields[key];
    if (typeof v !== "string") return false;
    return normalizeLogin(v).toLowerCase() === target;
  });
}

async function main() {
  const loginArg = process.argv[2];
  if (!loginArg?.trim()) {
    console.error("Brug: npx tsx scripts/reset-family-by-login.ts <login>");
    process.exit(1);
  }
  const login = normalizeLogin(loginArg);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Mangler SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const year = getKursusYear();
  const tableKeys = [`participants_${year}`, `participants_${year - 1}`];
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  let deleted = 0;
  for (const tableKey of tableKeys) {
    const { data, error } = await supabase
      .from("fk_records")
      .select("id, fields")
      .eq("table_key", tableKey);
    if (error) throw new Error(error.message);
    const ids = (data ?? [])
      .filter((row) => recordMatchesLogin((row.fields ?? {}) as Record<string, unknown>, login))
      .map((row) => row.id as string);
    for (const id of ids) {
      const { error: delErr } = await supabase
        .from("fk_records")
        .delete()
        .eq("id", id)
        .eq("table_key", tableKey);
      if (delErr) throw new Error(delErr.message);
      deleted += 1;
      console.log(`Slettet ${tableKey} ${id}`);
    }
  }

  console.log(`Færdig: ${deleted} deltager-rækker for «${login}». Login i Brugere er uændret.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
