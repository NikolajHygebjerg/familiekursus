/**
 * Engangsmigrering: Airtable → Supabase (fk_records).
 *
 * Kræver i .env.local:
 *   AIRTABLE_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (service_role eyJ… — ikke sb_publishable_)
 *
 * Kør: npm run migrate:airtable-to-supabase
 *
 * Kør først SQL i supabase/migrations/001_fk_records.sql
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
function loadEnvFile(relativePath: string) {
  const path = resolve(process.cwd(), relativePath);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

import {
  AIRTABLE_MIGRATION_BASE_ID,
  ALDERSGRUPPER_AIRTABLE_NAMES,
  MIGRATION_TABLES,
} from "../src/lib/fk-records";
import { createAdminClient } from "../src/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const BATCH = 200;

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

type FetchResult =
  | { ok: true; records: AirtableRecord[]; source: string }
  | { ok: false; status: number; message: string };

async function fetchAirtableTableOnce(apiKey: string, table: string): Promise<FetchResult> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_MIGRATION_BASE_ID}/${encodeURIComponent(table)}`
    );
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, message: text };
    }
    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return { ok: true, records, source: table };
}

async function fetchAirtableTableWithAlternates(
  apiKey: string,
  primary: string,
  alternates: string[] = []
): Promise<{ records: AirtableRecord[]; source: string } | null> {
  const tried = new Set<string>();
  const candidates = [primary, ...alternates].filter((name) => {
    const key = name.trim();
    if (!key || tried.has(key)) return false;
    tried.add(key);
    return true;
  });

  for (const table of candidates) {
    const result = await fetchAirtableTableOnce(apiKey, table);
    if (result.ok) {
      if (result.records.length > 0 || table === primary) {
        return { records: result.records, source: result.source };
      }
      continue;
    }
    if (result.status === 403 || result.status === 404) {
      continue;
    }
    throw new Error(`${table}: ${result.status} ${result.message}`);
  }

  const last = await fetchAirtableTableOnce(apiKey, primary);
  if (last.ok) return { records: last.records, source: primary };
  return null;
}

async function fetchAirtableFieldNames(apiKey: string, tableIdOrName: string): Promise<string[]> {
  try {
    const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_MIGRATION_BASE_ID}/tables`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      tables?: { id: string; name?: string; fields?: { name: string }[] }[];
    };
    for (const t of data.tables ?? []) {
      if (t.id === tableIdOrName || t.name === tableIdOrName) {
        return (t.fields ?? []).map((f) => f.name).filter(Boolean);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

async function upsertRecords(
  supabase: SupabaseClient,
  tableKey: string,
  records: AirtableRecord[]
): Promise<void> {
  if (records.length === 0) return;

  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const rows = chunk.map((rec) => ({
      id: rec.id,
      table_key: tableKey,
      fields: rec.fields,
    }));
    const { error } = await supabase.from("fk_records").upsert(rows, { onConflict: "id" });
    if (error) {
      if (error.message.includes("permission denied")) {
        throw new Error(
          `${tableKey}: ${error.message}\n` +
            "→ Kør grant-SQL fra supabase/migrations/002_grants_fix.sql i Supabase SQL Editor.\n" +
            "→ Tjek at SUPABASE_SERVICE_ROLE_KEY er service_role (eyJ…), ikke publishable."
        );
      }
      throw new Error(`${tableKey} batch ${i}: ${error.message}`);
    }
  }
}

async function migrateTable(
  supabase: SupabaseClient,
  apiKey: string,
  airtable: string,
  tableKey: string,
  alternates: string[] = [],
  optional = false
): Promise<void> {
  const fetched = await fetchAirtableTableWithAlternates(apiKey, airtable, alternates);
  if (!fetched) {
    if (optional) {
      console.warn(`  ${airtable} → ${tableKey}: sprunget over (ingen adgang / findes ikke)`);
      return;
    }
    console.warn(`  ${airtable} → ${tableKey}: 0 rækker (tjek tabellenavn i Airtable)`);
    return;
  }

  const { records, source } = fetched;
  const label = source !== airtable ? `${airtable} [${source}]` : airtable;
  console.log(`  ${label} → ${tableKey}: ${records.length} rækker`);

  const fieldNames = await fetchAirtableFieldNames(apiKey, source);
  const inferred = new Set<string>(fieldNames);
  for (const rec of records) {
    for (const k of Object.keys(rec.fields)) inferred.add(k);
  }
  if (inferred.size > 0) {
    const { error: schemaErr } = await supabase.from("fk_table_schema").upsert({
      table_key: tableKey,
      field_names: Array.from(inferred),
    });
    if (schemaErr) {
      console.warn(`    Skema ${tableKey}:`, schemaErr.message);
    }
  }

  await upsertRecords(supabase, tableKey, records);
}

async function main() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [
    !apiKey?.trim() && "AIRTABLE_API_KEY",
    !url?.trim() && "SUPABASE_URL",
    !serviceKey?.trim() && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    console.error(`Mangler i .env.local: ${missing.join(", ")}`);
    console.error("Tip: tsx læser nu .env.local automatisk — gem filen og prøv igen.");
    process.exit(1);
  }

  if (serviceKey.includes("publishable") || serviceKey.startsWith("sb_publishable")) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY er publishable/anon — brug service_role fra Supabase → Settings → API (starter med eyJ…)."
    );
    process.exit(1);
  }

  const supabase = createAdminClient();

  console.log("Migrerer Airtable → Supabase…");

  for (const entry of MIGRATION_TABLES) {
    await migrateTable(
      supabase,
      apiKey,
      entry.airtable,
      entry.tableKey,
      entry.alternates ?? [],
      entry.optional ?? false
    );
  }

  console.log("  Aldersgrupper (forsøger flere tabellenavne)…");
  let aldersTotal = 0;
  for (const name of ALDERSGRUPPER_AIRTABLE_NAMES) {
    const result = await fetchAirtableTableOnce(apiKey, name);
    if (!result.ok) {
      if (result.status === 403 || result.status === 404) {
        console.warn(`    ${name}: sprunget over (${result.status})`);
        continue;
      }
      throw new Error(`${name}: ${result.status} ${result.message}`);
    }
    if (result.records.length === 0) continue;
    console.log(`    ${name} → aldersgrupper: ${result.records.length} rækker`);
    await upsertRecords(supabase, "aldersgrupper", result.records);
    aldersTotal += result.records.length;
  }
  if (aldersTotal === 0) {
    console.warn("    Aldersgrupper: ingen data migreret (token mangler måske scope til den tabel)");
  }

  console.log("Færdig. Fjern AIRTABLE_API_KEY fra Vercel når I har verificeret appen.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
