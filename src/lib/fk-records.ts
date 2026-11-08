import { createAdminClient } from "@/lib/supabase/admin";

export interface FkRecord {
  id: string;
  fields: Record<string, unknown>;
}

const TABLE_2026 = "tblbCaeQzsAhNQyF3";

const PROGRAM_ANSVAR_TABLE_CANDIDATES = [
  "Program ansvar",
  "Program Ansvar",
  "Programansvar",
  "Program ansvarlige",
];

const ALDERSGRUPPER_TABLE_NAMES = [
  "Aldersgrupper",
  "Børn i aldersgrupper",
  "Aftengrupper",
];

const TABLE_KEY_MAP: Record<string, string> = {
  [TABLE_2026]: "participants_2026",
  "2026": "participants_2026",
  Betalt: "betalt",
  Program: "program",
  Brugere: "brugere",
  Workshopoversigt: "workshopoversigt",
  Workshopbackend: "workshopbackend",
  "Familieløbet": "familieloeb",
  "Mød os": "moed_os",
  "Forhåndstilmelding": "forhaandstilmelding",
  program_ansvar: "program_ansvar",
};

for (const name of PROGRAM_ANSVAR_TABLE_CANDIDATES) {
  TABLE_KEY_MAP[name] = "program_ansvar";
}
for (const name of ALDERSGRUPPER_TABLE_NAMES) {
  TABLE_KEY_MAP[name] = "aldersgrupper";
}

export function normalizeTableKey(tableIdOrName: string): string {
  const direct = TABLE_KEY_MAP[tableIdOrName];
  if (direct) return direct;
  if (/^\d{4}$/.test(tableIdOrName)) {
    return `participants_${tableIdOrName}`;
  }
  const participantsKey = `participants_${tableIdOrName}`;
  if (TABLE_KEY_MAP[participantsKey]) return TABLE_KEY_MAP[participantsKey];
  return tableIdOrName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const PAGE_SIZE = 1000;

/** Én sandhedskilde: alle rækkers table_key (til status / afstemning med SQL). */
export async function countFkRecordsByTableKey(): Promise<Record<string, number>> {
  const supabase = createAdminClient();
  const counts: Record<string, number> = {};
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("fk_records")
      .select("table_key")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) break;
    const batch = data ?? [];
    for (const row of batch) {
      const key = String(row.table_key ?? "");
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return counts;
}

/** jsonb kan i sjældne tilfælde komme tilbage som (dobbelt-)encodet JSON-streng — parser til objekt. */
export function coerceFkFields(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    let parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return {};
      }
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

export async function fetchFkRecords(tableIdOrName: string): Promise<FkRecord[]> {
  const tableKey = normalizeTableKey(tableIdOrName);
  const supabase = createAdminClient();
  const all: FkRecord[] = [];
  let from = 0;

  while (true) {
    // Uden .order(): PostgREST + range kan returnere tom batch på nogle hosts (Vercel).
    const { data, error } = await supabase
      .from("fk_records")
      .select("id, fields")
      .eq("table_key", tableKey)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Supabase (fk_records): ${error.message}`);
    }

    const batch = (data ?? []).map((row) => ({
      id: row.id as string,
      fields: coerceFkFields(row.fields),
    }));

    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

export async function createFkRecord(
  tableIdOrName: string,
  fields: Record<string, unknown>
): Promise<{ id: string }> {
  const tableKey = normalizeTableKey(tableIdOrName);
  const id = crypto.randomUUID();
  const supabase = createAdminClient();

  const { error } = await supabase.from("fk_records").insert({
    id,
    table_key: tableKey,
    fields,
  });

  if (error) {
    throw new Error(`Supabase insert fejl: ${error.message}`);
  }

  return { id };
}

export async function updateFkRecord(
  tableIdOrName: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const tableKey = normalizeTableKey(tableIdOrName);
  const supabase = createAdminClient();

  const { data: existing, error: loadError } = await supabase
    .from("fk_records")
    .select("fields")
    .eq("id", recordId)
    .eq("table_key", tableKey)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Supabase load fejl: ${loadError.message}`);
  }
  if (!existing) {
    throw new Error(`Post ikke fundet (${recordId})`);
  }

  const merged = {
    ...coerceFkFields(existing.fields),
    ...fields,
  };

  const { error } = await supabase
    .from("fk_records")
    .update({ fields: merged })
    .eq("id", recordId)
    .eq("table_key", tableKey);

  if (error) {
    throw new Error(`Supabase update fejl: ${error.message}`);
  }
}

export async function deleteFkRecord(tableIdOrName: string, recordId: string): Promise<void> {
  const tableKey = normalizeTableKey(tableIdOrName);
  const supabase = createAdminClient();

  const { error } = await supabase.from("fk_records").delete().eq("id", recordId).eq("table_key", tableKey);

  if (error) {
    throw new Error(`Supabase delete fejl: ${error.message}`);
  }
}

export async function getFkTableFieldNames(tableIdOrName: string): Promise<Set<string>> {
  const tableKey = normalizeTableKey(tableIdOrName);
  const supabase = createAdminClient();

  const { data: schemaRow } = await supabase
    .from("fk_table_schema")
    .select("field_names")
    .eq("table_key", tableKey)
    .maybeSingle();

  const fromSchema = (schemaRow?.field_names ?? []) as string[];
  if (fromSchema.length > 0) {
    return new Set(fromSchema);
  }

  const records = await fetchFkRecords(tableIdOrName);
  const allNames = new Set<string>();
  for (const rec of records) {
    for (const key of Object.keys(rec.fields)) {
      allNames.add(key);
    }
  }
  return allNames;
}

export async function upsertFkTableSchema(tableKey: string, fieldNames: string[]): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("fk_table_schema").upsert({
    table_key: tableKey,
    field_names: fieldNames,
  });
  if (error) {
    throw new Error(`Kunne ikke gemme skema for ${tableKey}: ${error.message}`);
  }
}

/** Airtable base-ID — kun til engangsmigrering. */
export const AIRTABLE_MIGRATION_BASE_ID = "appWYXnvNcnZS3yPu";

export const MIGRATION_TABLES: {
  airtable: string;
  tableKey: string;
  alternates?: string[];
  optional?: boolean;
}[] = [
  { airtable: TABLE_2026, tableKey: "participants_2026", alternates: ["2026"] },
  { airtable: "Betalt", tableKey: "betalt", alternates: ["betalt"] },
  { airtable: "Program", tableKey: "program" },
  { airtable: "Brugere", tableKey: "brugere" },
  { airtable: "Workshopoversigt", tableKey: "workshopoversigt" },
  { airtable: "Workshopbackend", tableKey: "workshopbackend" },
  { airtable: "Familieløbet", tableKey: "familieloeb" },
  { airtable: "Mød os", tableKey: "moed_os" },
  { airtable: "Forhåndstilmelding", tableKey: "forhaandstilmelding" },
  {
    airtable: "Program ansvar",
    tableKey: "program_ansvar",
    alternates: ["Program Ansvar", "Programansvar", "Program ansvarlige"],
    optional: true,
  },
];

export const ALDERSGRUPPER_AIRTABLE_NAMES = [
  "Aldersgrupper",
  "Børn i aldersgrupper",
  "Aftengrupper",
] as const;
