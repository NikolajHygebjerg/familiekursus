const AIRTABLE_BASE_ID = "appWYXnvNcnZS3yPu";
// 2026: workshop-tilmeldinger (tabel-ID fra Airtable-URL). Betalt: tabel med dem der har betalt. Program: dagsprogrammer
const TABLE_2026 = "tblbCaeQzsAhNQyF3";
const TABLE_BETALT = "Betalt";
const TABLE_PROGRAM = "Program";
const TABLE_BRUGERE = "Brugere";
const TABLE_WORKSHOPOVERSIGT = "Workshopoversigt";
const TABLE_FAMILIELOEB = "Familieløbet";

const EMAIL_FIELDS = ["Email", "email", "A Email"];

// Feltnavne for workshop-kolonner i 2026-tabellen (Deltagerliste)
export const WORKSHOP_FIELDS: Record<string, string[]> = {
  workshop1: ["Workshop 1", "A Workshop 1"],
  workshop2: ["Workshop 2", "A Workshop 2"],
  workshop3: ["Workshop 3", "A Workshop 3"],
  workshop4: ["Workshop 4", "A Workshop 4"],
  voksen: ["Workshop Forældre", "Forældreworkshop", "A Workshop Forældre", "A Forældreworkshop"],
};

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

export interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

async function fetchTableRecords(tableIdOrName: string): Promise<AirtableRecord[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    throw new Error("AIRTABLE_API_KEY er ikke sat. Tilføj den i .env.local eller Vercel miljøvariabler.");
  }

  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  const encodedTable = encodeURIComponent(tableIdOrName);

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodedTable}`
    );
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 60 }, // Cache i 60 sekunder
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Airtable API fejl (${response.status}): ${error}`);
    }

    const data: AirtableResponse = await response.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

async function fetchAllRecords(): Promise<AirtableRecord[]> {
  return fetchTableRecords(TABLE_2026);
}

function getWorkshopValues(record: AirtableRecord, possibleNames: string[]): string[] {
  for (const name of possibleNames) {
    if (name in record.fields && record.fields[name]) {
      const value = record.fields[name];
      if (typeof value === "string") return value.trim() ? [value.trim()] : [];
      if (Array.isArray(value))
        return value
          .map((v) => (typeof v === "string" ? v.trim() : String(v).trim()))
          .filter(Boolean);
      return [String(value).trim()].filter(Boolean);
    }
  }
  return [];
}

// Feltnavne for Familie og Navn (Betalt kan bruge andre navne)
const FAMILIE_FIELDS = ["Familie", "familie", "Family", "family"];
const NAVN_FIELDS = ["Navn", "navn", "Name", "name"];
const FAMILIELOEB_HOLD_FIELDS = ["Holdnavn", "A Holdnavn", "Hold", "A Hold"];
const FAMILIELOEB_MEDLEMMER_FIELDS = ["Medlemmer", "A Medlemmer"];

function getFieldValue(record: AirtableRecord, possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    if (name in record.fields && record.fields[name]) {
      const value = record.fields[name];
      if (typeof value === "string") return value.trim() || null;
      if (Array.isArray(value) && value.length > 0)
        return (typeof value[0] === "string" ? value[0] : String(value[0])).trim() || null;
      return String(value).trim() || null;
    }
  }
  return null;
}

export interface WorkshopCount {
  name: string;
  count: number;
  participants?: string[];
}

export async function getWorkshopCounts(
  workshopKey: keyof typeof WORKSHOP_FIELDS,
  withParticipants = false
): Promise<WorkshopCount[]> {
  const records = await fetchAllRecords();
  const possibleNames = WORKSHOP_FIELDS[workshopKey];
  const counts = new Map<string, { count: number; participants: string[] }>();

  for (const record of records) {
    const workshopNames = getWorkshopValues(record, possibleNames);
    const participantName = getFieldValue(record, NAVN_FIELDS) || "Ukendt";
    for (const name of workshopNames) {
      const existing = counts.get(name) || { count: 0, participants: [] };
      existing.count += 1;
      existing.participants.push(participantName);
      counts.set(name, existing);
    }
  }

  return Array.from(counts.entries())
    .map(([name, { count, participants }]) => ({
      name,
      count,
      ...(withParticipants && { participants }),
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getFamilies(): Promise<string[]> {
  const records = await fetchAllRecords();
  const families = new Set<string>();
  for (const record of records) {
    const fam = getFieldValue(record, FAMILIE_FIELDS);
    if (fam) families.add(fam);
  }
  return Array.from(families).sort((a, b) => a.localeCompare(b));
}

export async function getEmailsFrom2026(): Promise<string[]> {
  const records = await fetchAllRecords();
  const emails = new Set<string>();
  for (const record of records) {
    const em = getEmailFromRecord(record);
    if (em?.trim()) emails.add(em.trim().toLowerCase());
  }
  return Array.from(emails).sort((a, b) => a.localeCompare(b));
}

function getEmailFromRecord(record: AirtableRecord): string | null {
  return getFieldValue(record, EMAIL_FIELDS);
}

export async function getFamilyByEmail(email: string): Promise<string | null> {
  const records = await fetchAllRecords();
  for (const record of records) {
    const recEmail = getEmailFromRecord(record);
    if (recEmail?.toLowerCase() === email.toLowerCase()) {
      const fam = getFieldValue(record, FAMILIE_FIELDS);
      return fam || null;
    }
  }
  return null;
}

export async function emailExistsIn2026(email: string): Promise<boolean> {
  const records = await fetchAllRecords();
  for (const record of records) {
    const recEmail = getEmailFromRecord(record);
    if (recEmail?.toLowerCase() === email.toLowerCase()) return true;
  }
  return false;
}

export function getYearTableId(year: number): string {
  return year === 2026 ? TABLE_2026 : String(year);
}

export async function hasWorkshopRegistration(email: string, year: number): Promise<boolean> {
  const tableId = getYearTableId(year);
  const records = await fetchTableRecords(tableId);
  for (const record of records) {
    const recEmail = getEmailFromRecord(record);
    if (recEmail?.toLowerCase() === email.toLowerCase()) {
      const hasWs =
        getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop1) ||
        getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop2) ||
        getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop3) ||
        getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop4) ||
        getFirstWorkshopValue(record, WORKSHOP_FIELDS.voksen);
      if (hasWs) return true;
    }
  }
  return false;
}

const KODE_FIELDS = ["A Kode", "Kode", "kode", "Code", "code"];

export async function getBrugerCode(email: string): Promise<string | null> {
  try {
    const records = await fetchTableRecords(TABLE_BRUGERE);
    for (const record of records) {
      const recEmail = getEmailFromRecord(record);
      if (recEmail?.toLowerCase() === email.toLowerCase()) {
        const c = getFieldValue(record, KODE_FIELDS);
        if (c?.trim()) return c;
      }
    }
  } catch {
    // Brugere table might not exist
  }
  return null;
}

export async function brugerExistsInBrugere(email: string): Promise<boolean> {
  const recordId = await getBrugerRecordId(email);
  return recordId !== null;
}

export async function createAirtableRecord(
  tableIdOrName: string,
  fields: Record<string, unknown>
): Promise<{ id: string }> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    throw new Error("AIRTABLE_API_KEY er ikke sat.");
  }

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableIdOrName)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records: [{ fields }] }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Airtable fejl (${response.status}): ${err}`);
  }

  const data = (await response.json()) as { records: { id: string }[] };
  return { id: data.records[0].id };
}

export async function updateAirtableRecord(
  tableIdOrName: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    throw new Error("AIRTABLE_API_KEY er ikke sat.");
  }

  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Airtable fejl (${response.status}): ${err}`);
  }
}

export async function getBrugerRecordId(email: string): Promise<string | null> {
  try {
    const records = await fetchTableRecords(TABLE_BRUGERE);
    let recordId: string | null = null;
    for (const record of records) {
      const recEmail = getEmailFromRecord(record);
      if (recEmail?.toLowerCase() === email.toLowerCase()) {
        const c = getFieldValue(record, KODE_FIELDS);
        if (c?.trim()) return record.id;
        recordId = record.id;
      }
    }
    return recordId;
  } catch {
    // Brugere table might not exist
  }
  return null;
}

// Workshopoversigt: hver workshop har sin egen kolonne med række 1-6
const WORKSHOPOVERSIGT_OPTION_FIELDS: Record<string, string[]> = {
  workshop1: ["A Workshop 1", "Workshop 1"],
  workshop2: ["A Workshop 2", "Workshop 2"],
  workshop3: ["A Workshop 3", "Workshop 3"],
  workshop4: ["A Workshop 4", "Workshop 4"],
  voksen: ["Forældreworkshop", "A Forældreworkshop", "A Workshop Forældre", "Workshop Forældre"],
  aftengrupper: ["A Aftengrupper", "Aftengrupper", "Aftengrupper tilmelding"],
};

export async function getWorkshopOptions(year: number): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {
    workshop1: [],
    workshop2: [],
    workshop3: [],
    workshop4: [],
    voksen: [],
  };

  // Hent valgmuligheder fra Workshopoversigt – hver kolonne har sine egne options
  try {
    const woRecords = await fetchTableRecords(TABLE_WORKSHOPOVERSIGT);
    for (const key of Object.keys(WORKSHOPOVERSIGT_OPTION_FIELDS) as (keyof typeof WORKSHOPOVERSIGT_OPTION_FIELDS)[]) {
      const names = WORKSHOPOVERSIGT_OPTION_FIELDS[key];
      const set = new Set<string>();
      for (const rec of woRecords) {
        const vals = getWorkshopValues(rec, names);
        for (const v of vals) set.add(v);
      }
      result[key] = Array.from(set).sort();
    }
  } catch {
    // Workshopoversigt kan mangle
  }

  return result;
}

// Årstabel: feltnavne – debug viser Aftengrupper (uden A), prøv Gyserløb/Sheltertur uden A
const ACTIVITY_FIELD_OPTIONS: Record<string, string[]> = {
  aftengrupper: ["Aftengrupper", "A Aftengrupper"],
  gyserløb: ["Gyserløb", "A Gyserløb"],
  sheltertur: ["Sheltertur", "A Sheltertur"],
};
const WORKSHOPOVERSIGT_MAX_FIELDS = ["# Max", "Max", "A Max"];

const BARN_VOKSEN_FIELDS_LIST = ["Barn/voksen", "Barn/Voksen", "barn_voksen"];
const ALDER_FIELD_OPTIONS = ["Alder", "A Alder", "#Alder", "alder", "Age", "age"];

function resolveFieldName(allFieldNames: Set<string>, possibleNames: string[]): string {
  for (const name of possibleNames) {
    if (allFieldNames.has(name)) return name;
  }
  return possibleNames[0];
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

export async function getAftengrupperOptions(): Promise<string[]> {
  const detailed = await getAftengrupperOptionsDetailed();
  return detailed.map((o) => o.name);
}

export interface AftengruppeOption {
  name: string;
  max: number | null;
  current: number;
  soldOut: boolean;
}

function parseMaxValue(raw: string | null): number | null {
  if (!raw) return null;
  const normalized = raw.replace(",", ".").trim();
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export async function getAftengrupperOptionsDetailed(): Promise<AftengruppeOption[]> {
  const names = WORKSHOPOVERSIGT_OPTION_FIELDS.aftengrupper;
  const workshopoversigtRecords = await fetchTableRecords(TABLE_WORKSHOPOVERSIGT);
  const yearRecords = await fetchTableRecords(getYearTableId(getCurrentYear()));

  const maxByOption = new Map<string, number | null>();
  for (const rec of workshopoversigtRecords) {
    const vals = getWorkshopValues(rec, names);
    if (vals.length === 0) continue;
    const maxVal = parseMaxValue(getFieldValue(rec, WORKSHOPOVERSIGT_MAX_FIELDS));
    for (const v of vals) {
      const key = v.trim();
      if (!key) continue;
      if (!maxByOption.has(key)) maxByOption.set(key, maxVal);
    }
  }

  const countByOption = new Map<string, number>();
  for (const rec of yearRecords) {
    const selected = getFieldValue(rec, ACTIVITY_FIELD_OPTIONS.aftengrupper);
    const key = selected?.trim();
    if (!key) continue;
    countByOption.set(key, (countByOption.get(key) || 0) + 1);
    if (!maxByOption.has(key)) maxByOption.set(key, null);
  }

  const allOptions = Array.from(maxByOption.keys()).sort((a, b) => a.localeCompare(b));
  return allOptions.map((name) => {
    const max = maxByOption.get(name) ?? null;
    const current = countByOption.get(name) || 0;
    return {
      name,
      max,
      current,
      soldOut: max !== null ? current >= max : false,
    };
  });
}

export interface ActivityRecord {
  name: string;
  value: string;
  alder?: string;
}

export async function getActivityParticipantsFromYearTable(
  fieldKey: "aftengrupper" | "gyserløb" | "sheltertur",
  year?: number
): Promise<string[]> {
  const y = year ?? getCurrentYear();
  const tableId = getYearTableId(y);
  const records = await fetchTableRecords(tableId);
  const result: ActivityRecord[] = [];
  for (const rec of records) {
    const navn = getFieldValue(rec, NAVN_FIELDS);
    const val = getFieldValue(rec, ACTIVITY_FIELD_OPTIONS[fieldKey]);
    const alder = getFieldValue(rec, ALDER_FIELD_OPTIONS);
    if (!val?.trim()) continue;
    result.push({ name: navn || "Ukendt", value: val, alder: alder || undefined });
  }
  if (fieldKey === "aftengrupper") {
    const byOption = new Map<string, string[]>();
    for (const { name, value } of result) {
      const opt = value || "Ukendt gruppe";
      const list = byOption.get(opt) || [];
      list.push(name);
      byOption.set(opt, list);
    }
    return Array.from(byOption.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([opt, names]) => `${opt}: ${names.join(", ")}`);
  }
  return result
    .map((r) => (r.alder ? `${r.name} (${r.alder})` : r.name))
    .filter(Boolean)
    .sort();
}

export async function getNamesFromYearTableForEmail(
  email: string,
  query?: string
): Promise<string[]> {
  const year = getCurrentYear();
  const tableId = getYearTableId(year);
  const records = await fetchTableRecords(tableId);
  const names = new Set<string>();
  const q = query?.trim().toLowerCase() ?? "";
  for (const rec of records) {
    const recEmail = getEmailFromRecord(rec);
    if (recEmail?.toLowerCase() !== email.toLowerCase()) continue;
    const navn = getFieldValue(rec, NAVN_FIELDS);
    if (!navn?.trim()) continue;
    if (!q || navn.toLowerCase().includes(q)) {
      names.add(navn.trim());
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export async function findRecordInYearTableByNavnAndEmail(
  navn: string,
  email: string
): Promise<AirtableRecord | null> {
  const year = getCurrentYear();
  const tableId = getYearTableId(year);
  const records = await fetchTableRecords(tableId);
  const navnNorm = navn.trim();
  for (const rec of records) {
    const recEmail = getEmailFromRecord(rec);
    if (recEmail?.toLowerCase() !== email.toLowerCase()) continue;
    const recNavn = getFieldValue(rec, NAVN_FIELDS);
    if (recNavn?.trim() === navnNorm) return rec;
  }
  return null;
}

async function getTableFieldNames(tableId: string): Promise<Set<string>> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) return new Set<string>();
  try {
    const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = (await res.json()) as { tables?: { id: string; name?: string; fields?: { name: string }[] }[] };
      const tables = data.tables ?? [];
      for (const t of tables) {
        if (t.id === tableId || t.name === tableId || t.name === "2026") {
          const names = new Set<string>();
          for (const f of t.fields ?? []) {
            if (f.name) names.add(f.name);
          }
          if (names.size > 0) return names;
          break;
        }
      }
    }
  } catch {
    // Fortsæt til fallback
  }
  const records = await fetchTableRecords(tableId);
  const allNames = new Set<string>();
  for (const rec of records) {
    for (const key of Object.keys(rec.fields)) {
      allNames.add(key);
    }
  }
  return allNames;
}

export async function getYearTableFieldNames(): Promise<string[]> {
  const year = getCurrentYear();
  const tableId = getYearTableId(year);
  const names = await getTableFieldNames(tableId);
  return Array.from(names).sort();
}

export async function addToYearTableActivity(
  fieldKey: "aftengrupper" | "gyserløb" | "sheltertur",
  navn: string,
  email: string,
  options?: { alder?: string; valgtOption?: string; type?: string }
): Promise<void> {
  const year = getCurrentYear();
  const tableId = getYearTableId(year);
  const record = await findRecordInYearTableByNavnAndEmail(navn.trim(), email.trim());
  if (!record) {
    throw new Error("Person ikke fundet. Tilmeld først workshops for at tilføje til aktiviteter.");
  }
  const activityFieldName = ACTIVITY_FIELD_OPTIONS[fieldKey][0];
  const alderFieldName = ALDER_FIELD_OPTIONS[0];
  const barnVoksenFieldName = BARN_VOKSEN_FIELDS_LIST[0];
  const fields: Record<string, string | number> = {};
  if (options?.type?.trim()) {
    fields[barnVoksenFieldName] = options.type.trim();
  }
  if (options?.alder?.trim()) {
    const alderNum = parseInt(options.alder.trim(), 10);
    fields[alderFieldName] = !isNaN(alderNum) ? alderNum : options.alder.trim();
  }
  if (fieldKey === "aftengrupper" && options?.valgtOption?.trim()) {
    fields[activityFieldName] = options.valgtOption.trim();
  } else if (fieldKey === "gyserløb" || fieldKey === "sheltertur") {
    fields[activityFieldName] = "Ja";
  }
  await updateAirtableRecord(tableId, record.id, fields);
}

// Behold for bagudkompatibilitet – læser nu fra årstabellen
export async function getWorkshopoversigtParticipants(
  fieldKey: "aftengrupper" | "gyserløb" | "sheltertur"
): Promise<string[]> {
  return getActivityParticipantsFromYearTable(fieldKey);
}

const BARN_VOKSEN_FIELDS = ["Barn/voksen", "Barn/Voksen", "barn_voksen"];

export interface FamilyMember {
  navn: string;
  workshop1: string | null;
  workshop2: string | null;
  workshop3: string | null;
  workshop4: string | null;
  voksen: string | null;
  type?: string | null;
}

function getFirstWorkshopValue(record: AirtableRecord, possibleNames: string[]): string | null {
  const values = getWorkshopValues(record, possibleNames);
  return values.length > 0 ? values[0] : null;
}

export async function getFamilyMembers(familyName: string): Promise<FamilyMember[]> {
  const records = await fetchAllRecords();
  const members: FamilyMember[] = [];

  for (const record of records) {
    const fam = getFieldValue(record, FAMILIE_FIELDS);
    if (fam?.toLowerCase() !== familyName.toLowerCase()) continue;

    const navn = getFieldValue(record, NAVN_FIELDS) || "Ukendt";
    const workshop1 = getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop1);
    const workshop2 = getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop2);
    const workshop3 = getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop3);
    const workshop4 = getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop4);
    const voksen = getFirstWorkshopValue(record, WORKSHOP_FIELDS.voksen);
    const type = getFieldValue(record, BARN_VOKSEN_FIELDS);

    members.push({
      navn,
      workshop1,
      workshop2,
      workshop3,
      workshop4,
      voksen,
      type,
    });
  }

  return members;
}

export async function getFamilyMembersByEmail(email: string): Promise<FamilyMember[]> {
  const records = await fetchAllRecords();
  const members: FamilyMember[] = [];

  for (const record of records) {
    const recEmail = getEmailFromRecord(record);
    if (recEmail?.toLowerCase() !== email.toLowerCase()) continue;

    const navn = getFieldValue(record, NAVN_FIELDS) || "Ukendt";
    const workshop1 = getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop1);
    const workshop2 = getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop2);
    const workshop3 = getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop3);
    const workshop4 = getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop4);
    const voksen = getFirstWorkshopValue(record, WORKSHOP_FIELDS.voksen);
    const type = getFieldValue(record, BARN_VOKSEN_FIELDS);

    members.push({
      navn,
      workshop1,
      workshop2,
      workshop3,
      workshop4,
      voksen,
      type,
    });
  }

  return members;
}

export interface MissingWorkshopItem {
  navn: string;
}

interface FamilyRaceMember {
  navn: string;
  alder: number | null;
}

interface FamilyRaceFamily {
  familie: string;
  members: FamilyRaceMember[];
}

interface FamilyRaceHold {
  holdnavn: string;
  families: FamilyRaceFamily[];
  count: number;
  childAgeBuckets: Set<string>;
}

export interface FamilyRaceInfo {
  holdnavn: string;
  membersText: string;
}

export interface FamilyRaceFamilyGroup {
  familyName: string;
  members: string[];
}

export interface FamilyRaceHoldView {
  recordId: string;
  holdnavn: string;
  membersText: string;
  families: FamilyRaceFamilyGroup[];
}

function toAgeBucket(age: number): string {
  if (age <= 5) return "3-5";
  if (age <= 8) return "6-8";
  if (age <= 11) return "9-11";
  if (age <= 14) return "12-14";
  return "15+";
}

function parseAge(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw.trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function memberLine(member: FamilyRaceMember): string {
  return member.alder !== null ? `${member.navn} (${member.alder} år)` : member.navn;
}

function familyLine(family: FamilyRaceFamily): string {
  const members = family.members.map(memberLine).join(", ");
  return `${family.familie}: ${members}`;
}

function holdMembersText(hold: FamilyRaceHold): string {
  return hold.families
    .slice()
    .sort((a, b) => a.familie.localeCompare(b.familie))
    .map(familyLine)
    .join("\n");
}

function parseFamilyRaceMembersText(membersText: string): FamilyRaceFamilyGroup[] {
  return membersText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { familyName: line, members: [] };
      const familyName = line.slice(0, idx).trim();
      const membersRaw = line.slice(idx + 1).trim();
      const members = membersRaw
        ? membersRaw
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean)
        : [];
      return { familyName, members };
    });
}

function buildFamilyRaceMembersText(families: FamilyRaceFamilyGroup[]): string {
  return families
    .slice()
    .sort((a, b) => a.familyName.localeCompare(b.familyName))
    .map((f) => `${f.familyName}: ${f.members.join(", ")}`)
    .join("\n");
}

function chooseHoldCount(totalParticipants: number): number {
  if (totalParticipants <= 0) return 1;
  const minHolds = Math.max(1, Math.ceil(totalParticipants / 12));
  const maxHolds = Math.max(minHolds, Math.floor(totalParticipants / 10));
  let best = minHolds;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let h = minHolds; h <= maxHolds; h++) {
    const avg = totalParticipants / h;
    const score = Math.abs(avg - 11);
    if (score < bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best;
}

function buildFamilyRaceHolds(families: FamilyRaceFamily[]): FamilyRaceHold[] {
  const totalParticipants = families.reduce((sum, f) => sum + f.members.length, 0);
  const holdCount = chooseHoldCount(totalParticipants);
  const targetSize = totalParticipants / holdCount;
  const holds: FamilyRaceHold[] = Array.from({ length: holdCount }, (_, i) => ({
    holdnavn: `Hold ${i + 1}`,
    families: [],
    count: 0,
    childAgeBuckets: new Set<string>(),
  }));

  const sortedFamilies = families
    .slice()
    .sort((a, b) => {
      const aChildren = a.members.filter((m) => m.alder !== null).length;
      const bChildren = b.members.filter((m) => m.alder !== null).length;
      return bChildren - aChildren || b.members.length - a.members.length;
    });

  for (const family of sortedFamilies) {
    const familyBuckets = new Set(
      family.members
        .filter((m) => m.alder !== null)
        .map((m) => toAgeBucket(m.alder as number))
    );

    let bestIdx = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < holds.length; i++) {
      const hold = holds[i];
      const newCount = hold.count + family.members.length;
      const overCapacityPenalty = newCount > 12 ? (newCount - 12) * 100 : 0;
      const underTargetPenalty = Math.max(0, targetSize - newCount);
      let overlap = 0;
      familyBuckets.forEach((b) => {
        if (hold.childAgeBuckets.has(b)) overlap += 1;
      });
      const overlapBonus = overlap * 2;
      const score = overCapacityPenalty + underTargetPenalty - overlapBonus + hold.count * 0.2;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const chosen = holds[bestIdx];
    chosen.families.push(family);
    chosen.count += family.members.length;
    familyBuckets.forEach((b) => chosen.childAgeBuckets.add(b));
  }

  return holds;
}

// Normaliser navn så "Lars Alexandersen" og "Alexandersen Lars" matcher (omvendt navnestilling)
function normaliserNavn(navn: string): string {
  const cleaned = navn
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const parts = cleaned.trim().split(/\s+/).filter(Boolean);
  return parts.sort().join(" ");
}

function hasAnyWorkshopSelection(record: AirtableRecord): boolean {
  const explicit =
    getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop1) ||
    getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop2) ||
    getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop3) ||
    getFirstWorkshopValue(record, WORKSHOP_FIELDS.workshop4) ||
    getFirstWorkshopValue(record, WORKSHOP_FIELDS.voksen);
  if (explicit) return true;

  // Fallback: accepter ukendte kolonnenavne der stadig ligner workshopfelter.
  for (const [key, raw] of Object.entries(record.fields)) {
    const keyNorm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const looksLikeWorkshop =
      keyNorm.includes("workshop") || keyNorm.includes("foraeldreworkshop");
    if (!looksLikeWorkshop) continue;
    if (typeof raw === "string" && raw.trim()) return true;
    if (Array.isArray(raw) && raw.some((v) => String(v).trim())) return true;
  }
  return false;
}

export async function getMissingWorkshopSelections(): Promise<MissingWorkshopItem[]> {
  const [betaltRecords, records2026] = await Promise.all([
    fetchTableRecords(TABLE_BETALT),
    fetchTableRecords(TABLE_2026),
  ]);

  // Byg set af normaliserede navne (fra 2026) der HAR valgt workshops
  const navneMedWorkshops = new Set<string>();
  const emailsMedWorkshops = new Set<string>();

  for (const record of records2026) {
    if (hasAnyWorkshopSelection(record)) {
      const navn = getFieldValue(record, NAVN_FIELDS);
      if (navn) navneMedWorkshops.add(normaliserNavn(navn));
      const email = getEmailFromRecord(record);
      if (email?.trim()) emailsMedWorkshops.add(email.trim().toLowerCase());
    }
  }

  // Find Betalt-records der IKKE har valgt workshops i 2026 (sammenlign via Navn, normaliseret)
  const missing: MissingWorkshopItem[] = [];
  const seen = new Set<string>();

  for (const record of betaltRecords) {
    const navn = getFieldValue(record, NAVN_FIELDS);
    if (!navn) continue;
    const email = getEmailFromRecord(record)?.trim().toLowerCase() || null;

    const normaliseret = normaliserNavn(navn);
    if (seen.has(normaliseret)) continue;
    if (email && seen.has(email)) continue;

    const hasByName = navneMedWorkshops.has(normaliseret);
    const hasByEmail = email ? emailsMedWorkshops.has(email) : false;
    if (!hasByName && !hasByEmail) {
      seen.add(normaliseret);
      if (email) seen.add(email);
      missing.push({ navn });
    }
  }

  return missing.sort((a, b) => a.navn.localeCompare(b.navn));
}

async function getFamilyRaceFamiliesFrom2026(): Promise<FamilyRaceFamily[]> {
  const records = await fetchTableRecords(TABLE_2026);
  const byFamily = new Map<string, FamilyRaceMember[]>();

  for (const rec of records) {
    const familie = getFieldValue(rec, FAMILIE_FIELDS)?.trim();
    const navn = getFieldValue(rec, NAVN_FIELDS)?.trim();
    if (!familie || !navn) continue;
    const alder = parseAge(getFieldValue(rec, ALDER_FIELD_OPTIONS));
    const list = byFamily.get(familie) || [];
    list.push({ navn, alder });
    byFamily.set(familie, list);
  }

  return Array.from(byFamily.entries())
    .map(([familie, members]) => ({ familie, members }))
    .filter((f) => f.members.length > 0);
}

export async function syncFamilieloebAssignments(): Promise<FamilyRaceInfo[]> {
  const families = await getFamilyRaceFamiliesFrom2026();
  const holds = buildFamilyRaceHolds(families);

  const fieldNames = await getTableFieldNames(TABLE_FAMILIELOEB);
  const holdField = resolveFieldName(fieldNames, FAMILIELOEB_HOLD_FIELDS);
  const medlemmerField = resolveFieldName(fieldNames, FAMILIELOEB_MEDLEMMER_FIELDS);

  const existing = await fetchTableRecords(TABLE_FAMILIELOEB);
  const byHoldName = new Map<string, string>();
  for (const rec of existing) {
    const name = getFieldValue(rec, FAMILIELOEB_HOLD_FIELDS);
    if (name?.trim()) byHoldName.set(name.trim(), rec.id);
  }

  const infos: FamilyRaceInfo[] = [];
  for (const hold of holds) {
    const membersText = holdMembersText(hold);
    const fields: Record<string, string> = {
      [holdField]: hold.holdnavn,
      [medlemmerField]: membersText,
    };
    const existingId = byHoldName.get(hold.holdnavn);
    if (existingId) {
      await updateAirtableRecord(TABLE_FAMILIELOEB, existingId, fields);
    } else {
      await createAirtableRecord(TABLE_FAMILIELOEB, fields);
    }
    infos.push({ holdnavn: hold.holdnavn, membersText });
  }

  return infos;
}

export async function getFamilieloebInfoByEmail(email: string): Promise<FamilyRaceInfo | null> {
  const records = await fetchTableRecords(TABLE_2026);
  let familyName: string | null = null;
  for (const rec of records) {
    const recEmail = getEmailFromRecord(rec);
    if (recEmail?.toLowerCase() !== email.toLowerCase()) continue;
    familyName = getFieldValue(rec, FAMILIE_FIELDS);
    if (familyName) break;
  }
  if (!familyName) return null;

  const assignments = await syncFamilieloebAssignments();
  for (const hold of assignments) {
    if (hold.membersText.toLowerCase().includes(`${familyName.toLowerCase()}:`)) {
      return hold;
    }
  }
  return null;
}

export async function getAllFamilieloebHolds(): Promise<FamilyRaceHoldView[]> {
  await syncFamilieloebAssignments();
  const records = await fetchTableRecords(TABLE_FAMILIELOEB);
  const result: FamilyRaceHoldView[] = [];
  for (const rec of records) {
    const holdnavn = getFieldValue(rec, FAMILIELOEB_HOLD_FIELDS);
    if (!holdnavn?.trim()) continue;
    const membersText = getFieldValue(rec, FAMILIELOEB_MEDLEMMER_FIELDS) || "";
    result.push({
      recordId: rec.id,
      holdnavn: holdnavn.trim(),
      membersText,
      families: parseFamilyRaceMembersText(membersText),
    });
  }
  return result.sort((a, b) => a.holdnavn.localeCompare(b.holdnavn));
}

export async function moveFamilyBetweenFamilieloebHolds(
  familyName: string,
  fromHold: string,
  toHold: string
): Promise<FamilyRaceHoldView[]> {
  if (!familyName.trim() || !fromHold.trim() || !toHold.trim() || fromHold === toHold) {
    return getAllFamilieloebHolds();
  }

  const fieldNames = await getTableFieldNames(TABLE_FAMILIELOEB);
  const holdField = resolveFieldName(fieldNames, FAMILIELOEB_HOLD_FIELDS);
  const medlemmerField = resolveFieldName(fieldNames, FAMILIELOEB_MEDLEMMER_FIELDS);

  const records = await fetchTableRecords(TABLE_FAMILIELOEB);
  const byHold = new Map<string, AirtableRecord>();
  for (const rec of records) {
    const hold = getFieldValue(rec, FAMILIELOEB_HOLD_FIELDS);
    if (hold?.trim()) byHold.set(hold.trim(), rec);
  }

  const fromRec = byHold.get(fromHold);
  const toRec = byHold.get(toHold);
  if (!fromRec || !toRec) {
    throw new Error("Kunne ikke finde begge hold i Familieløbet.");
  }

  const fromFamilies = parseFamilyRaceMembersText(getFieldValue(fromRec, FAMILIELOEB_MEDLEMMER_FIELDS) || "");
  const toFamilies = parseFamilyRaceMembersText(getFieldValue(toRec, FAMILIELOEB_MEDLEMMER_FIELDS) || "");

  const idx = fromFamilies.findIndex((f) => f.familyName.toLowerCase() === familyName.toLowerCase());
  if (idx === -1) return getAllFamilieloebHolds();

  const [moved] = fromFamilies.splice(idx, 1);
  if (!toFamilies.some((f) => f.familyName.toLowerCase() === moved.familyName.toLowerCase())) {
    toFamilies.push(moved);
  }

  await updateAirtableRecord(TABLE_FAMILIELOEB, fromRec.id, {
    [holdField]: fromHold,
    [medlemmerField]: buildFamilyRaceMembersText(fromFamilies),
  });

  await updateAirtableRecord(TABLE_FAMILIELOEB, toRec.id, {
    [holdField]: toHold,
    [medlemmerField]: buildFamilyRaceMembersText(toFamilies),
  });

  return getAllFamilieloebHolds();
}

// --- Program-tabel (dagsprogrammer fra Airtable) ---
// Struktur: Én række per programpunkt med kolonner A Dag, A Dato, A Tid, A Titel, A Workshop

type WorkshopSlot = "workshop1" | "workshop2" | "workshop3" | "workshop4" | "voksen" | "aftengrupper" | "gyserløb" | "sheltertur";

export interface ProgramItemFromAirtable {
  tid?: string;
  titel: string;
  workshopSlot?: WorkshopSlot;
  workshops?: string[];
}

export interface DagProgramFromAirtable {
  dag: string;
  dato?: string;
  program: ProgramItemFromAirtable[];
}

const PROGRAM_DAG_FIELDS = ["A Dag", "Dag", "dag"];
const PROGRAM_DATO_FIELDS = ["A Dato", "Dato", "dato"];
const PROGRAM_TID_FIELDS = ["A Tid", "Tid", "tid"];
const PROGRAM_TITEL_FIELDS = ["A Titel", "Titel", "titel"];
const PROGRAM_WORKSHOP_FIELDS = ["A Workshop", "Workshop", "workshop"];

function getFieldValueFromRecord(rec: AirtableRecord, possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    if (name in rec.fields && rec.fields[name]) {
      const value = rec.fields[name];
      if (typeof value === "string") return value.trim() || null;
      if (Array.isArray(value) && value.length > 0)
        return (typeof value[0] === "string" ? value[0] : String(value[0])).trim() || null;
      return String(value).trim() || null;
    }
  }
  return null;
}

function parseWorkshopValue(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v.trim() : String(v).trim()))
      .filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function getWorkshopSlotFromTitel(titel: string): WorkshopSlot | undefined {
  const t = titel.toLowerCase();
  if (t.includes("workshop 1") || t.includes("workshop1")) return "workshop1";
  if (t.includes("workshop 2") || t.includes("workshop2")) return "workshop2";
  if (t.includes("workshop 3") || t.includes("workshop3")) return "workshop3";
  if (t.includes("workshop 4") || t.includes("workshop4")) return "workshop4";
  if (t.includes("aftengrupper")) return "aftengrupper";
  if (t.includes("gyserløb") || t.includes("gyserlob")) return "gyserløb";
  if (t.includes("sheltertur")) return "sheltertur";
  if (t.includes("forældreworkshop") || t.includes("workshop forældre") || t.includes("voksen")) return "voksen";
  return undefined;
}

function timeToSortMinutes(tid: string): number {
  const m = tid.replace(/\./g, ":").match(/^(\d{1,2})[.:]?(\d{2})?/);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  return h * 60 + min;
}

export async function getProgram(): Promise<DagProgramFromAirtable[]> {
  const records = await fetchTableRecords(TABLE_PROGRAM);

  const dagOrder = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
  const byDag = new Map<string, AirtableRecord[]>();

  const dagNorm = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  for (const rec of records) {
    const dagRaw = getFieldValueFromRecord(rec, PROGRAM_DAG_FIELDS);
    if (!dagRaw) continue;
    const dag = dagNorm(dagRaw);
    const list = byDag.get(dag) || [];
    list.push(rec);
    byDag.set(dag, list);
  }

  const result: DagProgramFromAirtable[] = [];

  for (const dag of dagOrder) {
    const dagRecords = byDag.get(dag);
    if (!dagRecords || dagRecords.length === 0) continue;

    const program: ProgramItemFromAirtable[] = [];
    let dato: string | null = null;

    for (const rec of dagRecords) {
      const tid = getFieldValueFromRecord(rec, PROGRAM_TID_FIELDS);
      const titel = getFieldValueFromRecord(rec, PROGRAM_TITEL_FIELDS);
      if (!titel) continue;

      if (!dato) dato = getFieldValueFromRecord(rec, PROGRAM_DATO_FIELDS);

      const workshopRaw = getFieldValueFromRecord(rec, PROGRAM_WORKSHOP_FIELDS);
      const workshops = workshopRaw ? parseWorkshopValue(workshopRaw) : undefined;
      const slot = getWorkshopSlotFromTitel(titel);

      let cleanTitel = titel;
      if (tid) {
        const timePattern = /\d{1,2}[.:]\d{2}(?:[-\s]\d{1,2}[.:]\d{2})?[.:\s–-]*\s*/gi;
        let prev: string;
        do {
          prev = cleanTitel;
          cleanTitel = cleanTitel.replace(timePattern, "").trim();
        } while (cleanTitel !== prev);
      }

      program.push({
        tid: tid || undefined,
        titel: cleanTitel || titel,
        workshopSlot: slot,
        workshops: workshops?.length ? workshops : undefined,
      });
    }

    let sorted = program.sort((a, b) => {
      const ma = timeToSortMinutes(a.tid || "");
      const mb = timeToSortMinutes(b.tid || "");
      return ma - mb;
    });

    sorted = mergeSplitTimeItems(sorted);

    if (sorted.length > 0) {
      result.push({
        dag,
        dato: dato || undefined,
        program: sorted,
      });
    }
  }

  return result;
}

function mergeSplitTimeItems(program: ProgramItemFromAirtable[]): ProgramItemFromAirtable[] {
  const singleTime = /^\d{1,2}[.:]\d{2}$/;
  const result: ProgramItemFromAirtable[] = [];
  for (let i = 0; i < program.length; i++) {
    const curr = program[i];
    const next = program[i + 1];
    const currTid = (curr.tid || "").trim();
    const currTitel = (curr.titel || "").trim();
    const titelErKunTid = singleTime.test(currTitel) || currTitel === "";

    const kanMergeMedNext =
      next?.tid &&
      singleTime.test((next.tid || "").trim()) &&
      next.titel &&
      !singleTime.test((next.titel || "").trim());

    if (
      currTid &&
      singleTime.test(currTid) &&
      !currTid.includes("-") &&
      titelErKunTid &&
      kanMergeMedNext
    ) {
      result.push({
        tid: `${currTid}-${next.tid}`,
        titel: next.titel,
        workshopSlot: next.workshopSlot,
        workshops: next.workshops,
      });
      i++;
    } else if (
      currTid &&
      next?.tid &&
      !currTid.includes("-") &&
      (next.tid || "").trim() !== currTid &&
      curr.titel &&
      next.titel &&
      curr.titel.toLowerCase() === next.titel.toLowerCase()
    ) {
      result.push({
        tid: `${currTid}-${next.tid}`,
        titel: curr.titel,
        workshopSlot: curr.workshopSlot || next.workshopSlot,
        workshops: curr.workshops || next.workshops,
      });
      i++;
    } else if (titelErKunTid) {
      continue;
    } else {
      result.push(curr);
    }
  }
  return result;
}
