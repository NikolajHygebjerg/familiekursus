import fs from "fs";
import path from "path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

const AIRTABLE_BASE_ID = "appWYXnvNcnZS3yPu";
const TABLE_BRUGERE = "Brugere";
const EMAIL_FIELDS = ["Email", "email", "A Email"];
const KODE_FIELDS = ["A Kode", "Kode", "kode", "Code", "code"];
const BRUGERSTATUS_FIELDS = ["Brugerstatus", "A Brugerstatus", "brugerstatus"];
const NAVN_FIELDS = ["Navne", "Navn", "navn", "Name", "name"];

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

function getFieldValue(record: AirtableRecord, possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    if (!(name in record.fields)) continue;
    const value = record.fields[name];
    if (value == null || value === "") continue;
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value) && value.length > 0) {
      return (typeof value[0] === "string" ? value[0] : String(value[0])).trim() || null;
    }
    return String(value).trim() || null;
  }
  return null;
}

function isAdmin(record: AirtableRecord): boolean {
  const value = getFieldValue(record, BRUGERSTATUS_FIELDS)?.toLowerCase();
  return value === "admin" || value === "kursusleder";
}

function scoreRecord(record: AirtableRecord): number {
  let score = 0;
  if (getFieldValue(record, KODE_FIELDS)) score += 100;
  if (isAdmin(record)) score += 50;
  if (getFieldValue(record, NAVN_FIELDS)) score += 20;
  score += Object.values(record.fields).filter((value) => value != null && value !== "").length;
  return score;
}

async function fetchAllBrugere(apiKey: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_BRUGERE)}`
    );
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`Kunne ikke hente Brugere (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

async function deleteRecord(apiKey: string, recordId: string): Promise<void> {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_BRUGERE)}/${recordId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );
  if (!response.ok) {
    throw new Error(`Kunne ikke slette ${recordId} (${response.status}): ${await response.text()}`);
  }
}

async function main() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    throw new Error("AIRTABLE_API_KEY mangler i .env.local");
  }

  const records = await fetchAllBrugere(apiKey);
  const byEmail = new Map<string, AirtableRecord[]>();
  const withoutEmail: AirtableRecord[] = [];

  for (const record of records) {
    const email = getFieldValue(record, EMAIL_FIELDS)?.toLowerCase();
    if (!email) {
      withoutEmail.push(record);
      continue;
    }
    const list = byEmail.get(email) || [];
    list.push(record);
    byEmail.set(email, list);
  }

  const duplicateGroups = Array.from(byEmail.entries()).filter(([, group]) => group.length > 1);
  if (duplicateGroups.length === 0) {
    console.log(`Ingen dubletter fundet blandt ${records.length} brugere.`);
    if (withoutEmail.length > 0) {
      console.log(`${withoutEmail.length} poster uden email blev ikke rørt.`);
    }
    return;
  }

  console.log(`Fandt ${duplicateGroups.length} emails med dubletter.`);

  for (const [email, group] of duplicateGroups) {
    const sorted = [...group].sort((a, b) => scoreRecord(b) - scoreRecord(a));
    const keep = sorted[0];
    const remove = sorted.slice(1);

    console.log(`\n${email}`);
    console.log(
      `  Beholder: ${keep.id} (score ${scoreRecord(keep)}, status ${getFieldValue(keep, BRUGERSTATUS_FIELDS) || "-"})`
    );

    for (const record of remove) {
      console.log(`  Sletter: ${record.id} (score ${scoreRecord(record)})`);
      await deleteRecord(apiKey, record.id);
    }
  }

  console.log(`\nFærdig. Slettede ${duplicateGroups.reduce((sum, [, group]) => sum + group.length - 1, 0)} dubletter.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
