import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import {
  syncFamilieloebAssignments,
  syncFamilieloebFromManualHolds,
  getAllFamilieloebHolds,
  type ManualFamilyRaceHold,
} from "../src/lib/airtable";

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
const HOLD_FIELD_CANDIDATES = ["Familieløb", "Familieløb hold"];
const DEFAULT_EXCEL = path.join(process.env.HOME || "", "Downloads", "Familieløb.xlsx");

type AirtableRecord = { id: string; fields: Record<string, unknown> };

interface HoldPerson {
  name: string;
  age: number | null;
}

interface PersonMatch {
  holdNum: number;
  excelName: string;
  record: AirtableRecord;
}

function normalizeName(value: string): string {
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

function parseAge(raw: string | null): number | null {
  if (!raw) return null;
  const age = parseInt(raw, 10);
  return Number.isFinite(age) ? age : null;
}

function words(value: string): string[] {
  return normalizeName(value).split(" ").filter(Boolean);
}

function nameMatchScore(excelName: string, recordName: string, excelAge: number | null): number | null {
  const a = words(excelName);
  const b = words(recordName);
  if (a.length === 0 || b.length === 0) return null;

  const aJoined = a.join(" ");
  const bJoined = b.join(" ");
  if (aJoined === bJoined) return 100;

  if (aJoined.startsWith(bJoined + " ") || bJoined.startsWith(aJoined + " ")) return 90;

  if (a.length === 1) {
    if (bJoined === a[0]) return 95;
    if (b.length === 1 && b[0] === a[0]) return 95;
    if (b[0] === a[0] && b.length > 1) return 45;
    return null;
  }

  if (b.length === 1) {
    if (aJoined === b[0]) return 95;
    if (a[0] === b[0]) return 45;
    return null;
  }

  const aLast = a[a.length - 1];
  const bLast = b[b.length - 1];
  if (aLast === bLast && a[0] === b[0]) return 85;
  if (a.every((word) => b.includes(word))) return 80;

  if (a[0] === b[0] && a.length >= 2 && b.length >= 2) return 55;
  return null;
}

async function parseHoldWorkbook(filePath: string): Promise<Map<number, HoldPerson[]>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  const holds = new Map<number, HoldPerson[]>();
  let currentHold: number | null = null;

  sheet.eachRow((row) => {
    const rawName = row.getCell(1).value;
    if (rawName == null || String(rawName).trim() === "") return;
    const name = String(rawName).trim();
    const holdMatch = name.match(/^Hold\s+(\d+)/i);
    if (holdMatch) {
      currentHold = parseInt(holdMatch[1], 10);
      holds.set(currentHold, []);
      return;
    }
    if (currentHold == null) return;
    const ageRaw = row.getCell(2).value;
    const age =
      ageRaw == null || ageRaw === ""
        ? null
        : Number.isFinite(Number(ageRaw))
          ? Number(ageRaw)
          : null;
    holds.get(currentHold)!.push({ name, age });
  });

  return holds;
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

async function resolveHoldField(records: AirtableRecord[]): Promise<string> {
  const fieldNames = new Set<string>();
  for (const record of records) {
    for (const key of Object.keys(record.fields)) fieldNames.add(key);
  }
  for (const candidate of HOLD_FIELD_CANDIDATES) {
    if (fieldNames.has(candidate)) return candidate;
  }
  return HOLD_FIELD_CANDIDATES[0];
}

async function clearHoldField(
  apiKey: string,
  holdField: string,
  recordIds: string[]
): Promise<void> {
  for (let i = 0; i < recordIds.length; i += 10) {
    const chunk = recordIds.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_2026}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: chunk.map((id) => ({ id, fields: { [holdField]: null } })),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
  }
}

async function updateRecord(
  apiKey: string,
  holdField: string,
  recordId: string,
  holdValue: string
): Promise<void> {
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
    body: JSON.stringify({ fields: { [holdField]: holdValue } }),
  });
  if (!res.ok) throw new Error(await res.text());
}

function matchExcelPeople(
  holds: Map<number, HoldPerson[]>,
  records: AirtableRecord[]
): { matches: PersonMatch[]; unmatched: Array<{ hold: number; name: string }> } {
  const usedRecordIds = new Set<string>();
  const matches: PersonMatch[] = [];
  const unmatched: Array<{ hold: number; name: string }> = [];

  for (const [holdNum, persons] of holds.entries()) {
    for (const person of persons) {
      const scored = records
        .filter((record) => !usedRecordIds.has(record.id))
        .map((record) => {
          const navn = getField(record, ["Navn", "navn"]) || "";
          const score = nameMatchScore(person.name, navn, person.age);
          if (score == null) return null;
          const age = parseAge(getField(record, ["Alder", "A Alder"]));
          let distance = 0;
          if (person.age != null && age != null) distance = Math.abs(age - person.age);
          else if (person.age != null && age == null) distance = 3;
          if (person.age != null && age != null && distance > 1 && score < 85) return null;
          return { record, score, distance };
        })
        .filter((item): item is { record: AirtableRecord; score: number; distance: number } => !!item)
        .sort((a, b) => b.score - a.score || a.distance - b.distance);

      if (scored.length === 0) {
        unmatched.push({ hold: holdNum, name: person.name });
        continue;
      }

      const best = scored[0];
      usedRecordIds.add(best.record.id);
      matches.push({ holdNum, excelName: person.name, record: best.record });
    }
  }

  return { matches, unmatched };
}

function buildManualHolds(matches: PersonMatch[]): ManualFamilyRaceHold[] {
  const byHold = new Map<number, Map<string, Array<{ navn: string; alder: number | null }>>>();

  for (const match of matches) {
    const familie = getField(match.record, ["Familie", "familie"]);
    if (!familie) continue;
    let families = byHold.get(match.holdNum);
    if (!families) {
      families = new Map();
      byHold.set(match.holdNum, families);
    }
    const members = families.get(familie) || [];
    members.push({
      navn: getField(match.record, ["Navn", "navn"]) || "Ukendt",
      alder: parseAge(getField(match.record, ["Alder", "A Alder"])),
    });
    families.set(familie, members);
  }

  return [...byHold.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([holdNum, familiesMap]) => ({
      holdnavn: `Hold ${holdNum}`,
      families: [...familiesMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "da"))
        .map(([familie, members]) => ({ familie, members })),
    }));
}

function reportSplitFamilies(matches: PersonMatch[]): void {
  const byFamily = new Map<string, Map<number, string[]>>();

  for (const match of matches) {
    const familie = getField(match.record, ["Familie", "familie"]);
    const navn = getField(match.record, ["Navn", "navn"]) || "Ukendt";
    if (!familie) continue;
    const holds = byFamily.get(familie) || new Map<number, string[]>();
    const list = holds.get(match.holdNum) || [];
    list.push(navn);
    holds.set(match.holdNum, list);
    byFamily.set(familie, holds);
  }

  const split = [...byFamily.entries()].filter(([, holds]) => holds.size > 1);
  console.log("\n=== Familier skilt på flere hold i Excel-filen ===");
  if (split.length === 0) {
    console.log("Ingen — alle matchede familiemedlemmer er på samme hold.");
    return;
  }

  for (const [familie, holds] of split.sort((a, b) => a[0].localeCompare(b[0], "da"))) {
    const parts = [...holds.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hold, names]) => `Hold ${hold}: ${names.join(", ")}`);
    console.log(`\n${familie}`);
    for (const part of parts) console.log(`  ${part}`);
  }
  console.log(`\nI alt ${split.length} familier skilt ad.`);
}

async function main() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) throw new Error("AIRTABLE_API_KEY mangler");

  const excelPath = process.argv.find((arg) => arg.endsWith(".xlsx")) || DEFAULT_EXCEL;
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel-fil ikke fundet: ${excelPath}`);
  }

  const dryRun = process.argv.includes("--dry-run");
  const skipSync = process.argv.includes("--skip-sync");
  const familieloebOnly = process.argv.includes("--familieloeb-only");

  const holds = await parseHoldWorkbook(excelPath);
  const records = await fetchAllRecords(apiKey);
  const { matches, unmatched } = matchExcelPeople(holds, records);
  const manualHolds = buildManualHolds(matches);
  const holdField = await resolveHoldField(records);

  console.log(`Kilde: ${excelPath}`);
  console.log(`Hold i filen: ${[...holds.keys()].sort((a, b) => a - b).join(", ")}`);
  console.log(`Matchede ${matches.length} personer til feltet «${holdField}»\n`);

  const byHold = new Map<number, PersonMatch[]>();
  for (const match of matches) {
    const list = byHold.get(match.holdNum) || [];
    list.push(match);
    byHold.set(match.holdNum, list);
  }

  for (const holdNum of [...byHold.keys()].sort((a, b) => a - b)) {
    const list = byHold.get(holdNum) || [];
    console.log(`Hold ${holdNum}: ${list.length} personer`);
    for (const match of list) {
      const navn = getField(match.record, ["Navn", "navn"]);
      const familie = getField(match.record, ["Familie", "familie"]);
      console.log(`  ✓ ${match.excelName} -> ${navn} (${familie})`);
    }
  }

  if (!familieloebOnly && !dryRun) {
    const withHold = records.filter((record) => getField(record, [holdField]));
    if (withHold.length > 0) {
      console.log(`\nRydder ${withHold.length} gamle hold-tildelinger...`);
      await clearHoldField(
        apiKey,
        holdField,
        withHold.map((record) => record.id)
      );
    }

    const familyHoldVotes = new Map<string, Map<number, number>>();
    for (const match of matches) {
      const familie = getField(match.record, ["Familie", "familie"]);
      if (!familie) continue;
      const key = familie.trim().replace(/\s+/g, " ").toLowerCase();
      const votes = familyHoldVotes.get(key) || new Map<number, number>();
      votes.set(match.holdNum, (votes.get(match.holdNum) || 0) + 1);
      familyHoldVotes.set(key, votes);
    }

    const familyToHold = new Map<string, number>();
    for (const [key, votes] of familyHoldVotes.entries()) {
      const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      familyToHold.set(key, sorted[0][0]);
    }

    const recordsByFamily = new Map<string, AirtableRecord[]>();
    for (const record of records) {
      const familie = getField(record, ["Familie", "familie"]);
      if (!familie) continue;
      const key = familie.trim().replace(/\s+/g, " ").toLowerCase();
      const list = recordsByFamily.get(key) || [];
      list.push(record);
      recordsByFamily.set(key, list);
    }

    for (const [familyKey, holdNum] of familyToHold.entries()) {
      const familyRecords = recordsByFamily.get(familyKey) || [];
      const holdValue = `Hold ${holdNum}`;
      for (const record of familyRecords) {
        await updateRecord(apiKey, holdField, record.id, holdValue);
      }
    }
  }

  if (unmatched.length > 0) {
    console.log(`\nKunne ikke matche ${unmatched.length} navne:`);
    for (const item of unmatched) {
      console.log(`- Hold ${item.hold}: ${item.name}`);
    }
  }

  const matchedRecordIds = new Set(matches.map((match) => match.record.id));
  const unmatchedRecords = records.filter((record) => {
    const familie = getField(record, ["Familie", "familie"]);
    return familie && !matchedRecordIds.has(record.id);
  });
  if (unmatchedRecords.length > 0) {
    const byFam = new Map<string, string[]>();
    for (const record of unmatchedRecords) {
      const familie = getField(record, ["Familie", "familie"])!;
      const navn = getField(record, ["Navn", "navn"]) || "Ukendt";
      const list = byFam.get(familie) || [];
      list.push(navn);
      byFam.set(familie, list);
    }
    console.log(`\n${byFam.size} familier/personer uden hold i Excel:`);
    for (const [familie, names] of [...byFam.entries()].sort((a, b) => a[0].localeCompare(b[0], "da"))) {
      console.log(`- ${familie}: ${names.join(", ")}`);
    }
  }

  reportSplitFamilies(matches);

  if (!dryRun && !skipSync) {
    console.log("\nSynkroniserer Familieløbet-tabellen...");
    if (familieloebOnly) {
      await syncFamilieloebFromManualHolds(manualHolds);
    } else {
      const { consolidateFamilieloebFamiliesIn2026 } = await import("../src/lib/airtable");
      await consolidateFamilieloebFamiliesIn2026();
      await syncFamilieloebAssignments();
    }
    const airtableHolds = await getAllFamilieloebHolds();
    console.log(`Familieløbet har nu ${airtableHolds.length} hold med indhold.`);
    for (const hold of airtableHolds.filter((item) => item.families.length > 0)) {
      console.log(`- ${hold.holdnavn}: ${hold.families.length} familier`);
    }
  }

  console.log("\nFærdig.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
