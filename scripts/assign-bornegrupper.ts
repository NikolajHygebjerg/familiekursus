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
const TABLE_2026 = "tblbCaeQzsAhNQyF3";
const BORNEGRUPPER_FIELD = "Børnegrupper";

type AirtableRecord = { id: string; fields: Record<string, unknown> };

interface ChildAssignment {
  searchName: string;
  group: string;
  ageHint?: number;
  minAge?: number;
  maxAge?: number;
}

const GROUPS = {
  g1: "Gruppe 1: 3-5 år",
  g2: "Gruppe 2:  6 år",
  g3: "Gruppe 3: 7-8 år",
  g4: "Gruppe 4: 8 år",
  g5: "Gruppe 5: 9 år",
  g6: "Gruppe 6: 9 år",
  g7: "Gruppe 7: 10-11 år",
  g8: "Gruppe 8: 11 år",
  g9: "Gruppe 9: 12 år",
  g10: "Gruppe 10: 13+ år",
} as const;

const ASSIGNMENTS: ChildAssignment[] = [
  // Gruppe 1
  { searchName: "Eigil", group: GROUPS.g1, ageHint: 3 },
  { searchName: "Karl Emil", group: GROUPS.g1, ageHint: 3 },
  { searchName: "Cirkeline", group: GROUPS.g1, ageHint: 4 },
  { searchName: "Elias", group: GROUPS.g1, ageHint: 4 },
  { searchName: "Ludvig", group: GROUPS.g1, ageHint: 4 },
  { searchName: "Oswald", group: GROUPS.g1, ageHint: 4 },
  { searchName: "Viola", group: GROUPS.g1, ageHint: 4 },
  { searchName: "Carla", group: GROUPS.g1, ageHint: 5 },
  { searchName: "Egon", group: GROUPS.g1, ageHint: 5 },
  { searchName: "Frida", group: GROUPS.g1, ageHint: 5 },
  { searchName: "Haley", group: GROUPS.g1, ageHint: 5 },
  // Gruppe 2
  { searchName: "Aksel", group: GROUPS.g2, ageHint: 6 },
  { searchName: "Eleonora", group: GROUPS.g2, ageHint: 6 },
  { searchName: "Finn", group: GROUPS.g2, ageHint: 6 },
  { searchName: "Laura", group: GROUPS.g2, ageHint: 6 },
  { searchName: "Lærke", group: GROUPS.g2, ageHint: 6 },
  { searchName: "Otto", group: GROUPS.g2, ageHint: 6 },
  { searchName: "Pil", group: GROUPS.g2, ageHint: 6 },
  { searchName: "Sigurd", group: GROUPS.g2, ageHint: 6 },
  { searchName: "Svend", group: GROUPS.g2, ageHint: 6 },
  // Gruppe 3
  { searchName: "Anker", group: GROUPS.g3, minAge: 7, maxAge: 8 },
  { searchName: "Carla", group: GROUPS.g3, ageHint: 7 },
  { searchName: "Rosa", group: GROUPS.g3, minAge: 7, maxAge: 8 },
  { searchName: "Zeno", group: GROUPS.g3, minAge: 7, maxAge: 8 },
  { searchName: "Alfred", group: GROUPS.g3, ageHint: 8 },
  { searchName: "Benjamin", group: GROUPS.g3, minAge: 7, maxAge: 8 },
  { searchName: "Esther-Marie", group: GROUPS.g3, minAge: 7, maxAge: 8 },
  { searchName: "Halfdan", group: GROUPS.g3, minAge: 7, maxAge: 8 },
  { searchName: "Jason", group: GROUPS.g3, minAge: 7, maxAge: 8 },
  // Gruppe 4
  { searchName: "Johanna", group: GROUPS.g4, ageHint: 8 },
  { searchName: "Le Ohm", group: GROUPS.g4, ageHint: 8 },
  { searchName: "Magne", group: GROUPS.g4, ageHint: 8 },
  { searchName: "Niels", group: GROUPS.g4, ageHint: 8 },
  { searchName: "Oskar", group: GROUPS.g4, ageHint: 8 },
  { searchName: "Otto", group: GROUPS.g4, ageHint: 8 },
  { searchName: "Rita", group: GROUPS.g4, ageHint: 8 },
  { searchName: "Sigurd", group: GROUPS.g4, ageHint: 8 },
  // Gruppe 5
  { searchName: "Agathe", group: GROUPS.g5, ageHint: 9 },
  { searchName: "Alma", group: GROUPS.g5, ageHint: 9 },
  { searchName: "Ari", group: GROUPS.g5, ageHint: 9 },
  { searchName: "Fenja", group: GROUPS.g5, ageHint: 9 },
  { searchName: "Iris", group: GROUPS.g5, ageHint: 9 },
  { searchName: "Julian", group: GROUPS.g5, ageHint: 9 },
  { searchName: "Lauge", group: GROUPS.g5, ageHint: 9 },
  { searchName: "Laura", group: GROUPS.g5, ageHint: 9 },
  { searchName: "Laurits", group: GROUPS.g5, ageHint: 9 },
  // Gruppe 6
  { searchName: "Liv", group: GROUPS.g6, ageHint: 9 },
  { searchName: "Lærke", group: GROUPS.g6, ageHint: 9 },
  { searchName: "Neo", group: GROUPS.g6, ageHint: 9 },
  { searchName: "Nora", group: GROUPS.g6, ageHint: 9 },
  { searchName: "Ruben", group: GROUPS.g6, ageHint: 9 },
  { searchName: "Signe", group: GROUPS.g6, ageHint: 9 },
  { searchName: "Silje", group: GROUPS.g6, ageHint: 9 },
  { searchName: "Svend", group: GROUPS.g6, ageHint: 9 },
  { searchName: "Teo", group: GROUPS.g6, ageHint: 9 },
  { searchName: "Isabella", group: GROUPS.g6, ageHint: 9 },
  // Gruppe 7
  { searchName: "Agnes", group: GROUPS.g7, minAge: 10, maxAge: 11 },
  { searchName: "Carl Gilbert", group: GROUPS.g7, minAge: 10, maxAge: 11 },
  { searchName: "Isabella Lykke", group: GROUPS.g7, minAge: 10, maxAge: 11 },
  { searchName: "Johanne", group: GROUPS.g7, minAge: 10, maxAge: 11 },
  { searchName: "Knud", group: GROUPS.g7, minAge: 10, maxAge: 11 },
  { searchName: "Nora", group: GROUPS.g7, minAge: 10, maxAge: 11 },
  { searchName: "Oscar", group: GROUPS.g7, minAge: 10, maxAge: 11 },
  { searchName: "Wilma", group: GROUPS.g7, minAge: 10, maxAge: 11 },
  { searchName: "Sofus", group: GROUPS.g7, minAge: 10, maxAge: 11 },
  // Gruppe 8
  { searchName: "Aksel", group: GROUPS.g8, ageHint: 11 },
  { searchName: "Asger", group: GROUPS.g8, ageHint: 11 },
  { searchName: "Clara", group: GROUPS.g8, ageHint: 11 },
  { searchName: "Dora", group: GROUPS.g8, ageHint: 11 },
  { searchName: "Ellen", group: GROUPS.g8, ageHint: 11 },
  { searchName: "Fine", group: GROUPS.g8, ageHint: 11 },
  { searchName: "Johan", group: GROUPS.g8, ageHint: 11 },
  { searchName: "Kalle", group: GROUPS.g8, ageHint: 11 },
  { searchName: "Kristian", group: GROUPS.g8, ageHint: 11 },
  { searchName: "Laurits", group: GROUPS.g8, ageHint: 11 },
  // Gruppe 9
  { searchName: "Olga", group: GROUPS.g9, ageHint: 12 },
  { searchName: "Solvej", group: GROUPS.g9, ageHint: 12 },
  { searchName: "Thea", group: GROUPS.g9, ageHint: 12 },
  { searchName: "Vilja", group: GROUPS.g9, ageHint: 12 },
  { searchName: "Alfred", group: GROUPS.g9, ageHint: 12 },
  { searchName: "Hugo", group: GROUPS.g9, ageHint: 12 },
  { searchName: "Thøger", group: GROUPS.g9, ageHint: 12 },
  { searchName: "Victor", group: GROUPS.g9, ageHint: 12 },
  // Gruppe 10
  { searchName: "Alfred", group: GROUPS.g10, minAge: 13 },
  { searchName: "Ellen", group: GROUPS.g10, minAge: 13 },
  { searchName: "Helene", group: GROUPS.g10, minAge: 13 },
  { searchName: "Markus", group: GROUPS.g10, minAge: 13 },
  { searchName: "Villads", group: GROUPS.g10, minAge: 13 },
  { searchName: "Cecilia", group: GROUPS.g10, minAge: 13 },
  { searchName: "Theresa", group: GROUPS.g10, minAge: 13 },
  { searchName: "Thora", group: GROUPS.g10, minAge: 13 },
  { searchName: "Valdemar", group: GROUPS.g10, minAge: 13 },
  { searchName: "Alba", group: GROUPS.g10, ageHint: 15 },
  { searchName: "Rasmus", group: GROUPS.g10, ageHint: 15 },
  { searchName: "Bertil", group: GROUPS.g10, minAge: 13 },
  { searchName: "Marius", group: GROUPS.g10, minAge: 13 },
  { searchName: "Selma V", group: GROUPS.g10, minAge: 13 },
  { searchName: "Stéphane", group: GROUPS.g10, minAge: 13 },
  { searchName: "Maja", group: GROUPS.g10, minAge: 13 },
];

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function getField(record: AirtableRecord, names: string[]): string | null {
  for (const name of names) {
    const value = record.fields[name];
    if (value == null || value === "") continue;
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

const MANUAL_FULL_NAME_OVERRIDES: Record<string, string> = {
  "Isabella Lykke": "Isabella Lykke-Brøndum",
  "Selma V": "Selma Victoria Jørgensen",
};

function firstNameMatches(fullName: string, searchName: string): boolean {
  const full = normalize(fullName);
  const search = normalize(searchName);
  const override = MANUAL_FULL_NAME_OVERRIDES[searchName];
  if (override && normalize(override) === full) return true;
  return full === search || full.startsWith(`${search} `) || full.startsWith(`${search}-`);
}

function ageMatches(age: number | null, assignment: ChildAssignment): boolean {
  if (age == null) return true;
  if (assignment.ageHint != null) return age === assignment.ageHint;
  if (assignment.minAge != null && age < assignment.minAge) return false;
  if (assignment.maxAge != null && age > assignment.maxAge) return false;
  if (assignment.minAge != null && assignment.maxAge == null) return age >= assignment.minAge;
  return true;
}

function ageDistance(age: number | null, assignment: ChildAssignment): number {
  if (age == null) return 5;
  if (assignment.ageHint != null) return Math.abs(age - assignment.ageHint);
  if (assignment.minAge != null && assignment.maxAge != null) {
    if (age < assignment.minAge) return assignment.minAge - age;
    if (age > assignment.maxAge) return age - assignment.maxAge;
    return 0;
  }
  if (assignment.minAge != null && age < assignment.minAge) return assignment.minAge - age;
  return 0;
}

async function fetchAllRecords(apiKey: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_2026}`);
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

async function updateRecord(apiKey: string, recordId: string, group: string): Promise<void> {
  const url = new URL(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_2026}/${recordId}`
  );
  url.searchParams.set("typecast", "true");
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: { [BORNEGRUPPER_FIELD]: group } }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function main() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) throw new Error("AIRTABLE_API_KEY mangler");
  const dryRun = process.argv.includes("--dry-run");

  const records = await fetchAllRecords(apiKey);
  const children = records.filter((record) => {
    const type = getField(record, ["Barn/voksen", "Barn/Voksen"]);
    const alder = getField(record, ["Alder"]);
    return type?.toLowerCase() === "barn" || !!alder;
  });

  const usedRecordIds = new Set<string>();
  const matched: Array<{ assignment: ChildAssignment; record: AirtableRecord }> = [];
  const unmatched: ChildAssignment[] = [];
  const failed: Array<{
    assignment: ChildAssignment;
    record: AirtableRecord;
    error: string;
  }> = [];

  for (const assignment of ASSIGNMENTS) {
    const alderFor = (record: AirtableRecord) => {
      const alderRaw = getField(record, ["Alder"]);
      const age = alderRaw ? parseInt(alderRaw, 10) : null;
      return Number.isFinite(age) ? age : null;
    };

    const nameMatches = (record: AirtableRecord) =>
      firstNameMatches(getField(record, ["Navn"]) || "", assignment.searchName);

    const available = children.filter((record) => !usedRecordIds.has(record.id) && nameMatches(record));

    if (available.length === 0) {
      unmatched.push(assignment);
      continue;
    }

    const candidates = [...available].sort(
      (a, b) => ageDistance(alderFor(a), assignment) - ageDistance(alderFor(b), assignment)
    );

    const best = candidates[0];
    matched.push({ assignment, record: best });
    usedRecordIds.add(best.id);
  }

  console.log(`Matcher ${matched.length}/${ASSIGNMENTS.length} børn.\n`);

  for (const { assignment, record } of matched) {
    const navn = getField(record, ["Navn"]);
    const alder = getField(record, ["Alder"]);
    try {
      console.log(`✓ ${assignment.searchName} -> ${navn} (${alder} år) => ${assignment.group}`);
      if (!dryRun) await updateRecord(apiKey, record.id, assignment.group);
    } catch (error) {
      failed.push({
        assignment,
        record,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`✗ ${assignment.searchName} -> ${navn}: ${failed.at(-1)?.error}`);
    }
  }

  if (unmatched.length > 0) {
    console.log(`\nKunne ikke matche ${unmatched.length}:`);
    for (const item of unmatched) {
      const possible = children
        .filter((record) => firstNameMatches(getField(record, ["Navn"]) || "", item.searchName))
        .map((record) => `${getField(record, ["Navn"])} (${getField(record, ["Alder"])} år)`);
      console.log(`- ${item.searchName} -> ${item.group}; mulige: ${possible.join(", ") || "ingen"}`);
    }
  }

  if (failed.length > 0) {
    console.log(`\n${failed.length} opdateringer fejlede (manglende valgmuligheder i Airtable?):`);
    const groups = [...new Set(failed.map((item) => item.assignment.group))];
    for (const group of groups) {
      console.log(`- ${group}`);
    }
  }

  console.log("\nFærdig.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
