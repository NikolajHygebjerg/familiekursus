const AIRTABLE_BASE_ID = "appWYXnvNcnZS3yPu";
// 2026: workshop-tilmeldinger (tabel-ID fra Airtable-URL). Betalt: tabel med dem der har betalt. Program: dagsprogrammer
const TABLE_2026 = "tblbCaeQzsAhNQyF3";
const TABLE_BETALT = "Betalt";
const TABLE_PROGRAM = "Program";
const TABLE_BRUGERE = "Brugere";
const TABLE_WORKSHOPOVERSIGT = "Workshopoversigt";
const TABLE_WORKSHOPBACKEND = "Workshopbackend";
const TABLE_FAMILIELOEB = "Familieløbet";
const TABLE_MOED_OS = "Mød os";
const ALDERSGRUPPER_TABLE_NAMES = [
  "Aldersgrupper",
  "Børn i aldersgrupper",
  // Legacy – omdøb denne tabel til "Aldersgrupper" i Airtable (ikke aftengrupper-tilmelding)
  "Aftengrupper",
];

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
const BARN_VOKSEN_FIELDS = ["Barn/voksen", "Barn/Voksen", "barn_voksen"];
const ALDER_FIELD_OPTIONS = ["Alder", "A Alder", "#Alder", "alder", "Age", "age"];
const FAMILIELOEB_HOLD_FIELDS = ["Holdnavn", "A Holdnavn", "Hold", "A Hold"];
const FAMILIELOEB_MEDLEMMER_FIELDS = ["Medlemmer", "A Medlemmer"];

function getFieldValue(record: AirtableRecord, possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    if (!(name in record.fields)) continue;
    const value = record.fields[name];
    if (value == null || value === "") continue;
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value) && value.length > 0)
      return (typeof value[0] === "string" ? value[0] : String(value[0])).trim() || null;
    return String(value).trim() || null;
  }
  return null;
}

export interface WorkshopCount {
  name: string;
  count: number;
  participants?: string[];
}

export interface WorkshopParticipantDetail {
  navn: string;
  alder: string | null;
  type: string | null;
}

export interface WorkshopFamilyGroup {
  email: string;
  familie: string | null;
  members: WorkshopParticipantDetail[];
}

export interface WorkshopBackendInfo {
  underviser: string | null;
  hjaelpere: string | null;
  lokale: string | null;
}

const WORKSHOPBACKEND_NAME_FIELDS = ["Workshop", "workshop", "Navn", "navn"];
const WORKSHOPBACKEND_UNDERVISER_FIELDS = ["Underviser", "underviser"];
const WORKSHOPBACKEND_HJAELPERE_FIELDS = ["Hjælpere", "Hjaelpere", "Helpere"];
const WORKSHOPBACKEND_LOKALE_FIELDS = ["Lokale", "lokale", "Room", "room"];

function normalizeWorkshopName(name: string): string {
  return name
    .replace(/[\u2028\u2029]/g, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getWorkshopBackendInfo(
  workshopOptionName: string
): Promise<WorkshopBackendInfo | null> {
  try {
    const records = await fetchTableRecords(TABLE_WORKSHOPBACKEND);
    const target = normalizeWorkshopName(workshopOptionName);

    for (const record of records) {
      const parsed = readWorkshopBackendRecord(record);
      if (!parsed || normalizeWorkshopName(parsed.workshopName) !== target) continue;
      return parsed.info;
    }
  } catch {
    // Workshopbackend table might not exist yet
  }
  return null;
}

function getStaffFieldRaw(record: AirtableRecord, possibleNames: string[]): unknown {
  for (const name of possibleNames) {
    if (!(name in record.fields)) continue;
    const value = record.fields[name];
    if (value == null || value === "") continue;
    return value;
  }
  return null;
}

function staffNamesFromFieldValue(value: unknown): string[] {
  if (value == null || value === "") return [];
  if (typeof value === "string") return parseStaffNames(value);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return parseStaffNames(item);
      return [String(item).trim()].filter(Boolean);
    });
  }
  if (typeof value === "number") return [String(value)];
  return parseStaffNames(String(value));
}

function staffFieldDisplayValue(value: unknown): string | null {
  const names = staffNamesFromFieldValue(value);
  return names.length > 0 ? names.join(", ") : null;
}

function staffNamesIncludeAlle(names: string[]): boolean {
  return names.some((name) => normalizePersonName(name) === "alle");
}

function adminMatchesStaffNames(adminNavn: string, names: string[]): boolean {
  return names.some((name) => personNameMatchesStaff(adminNavn, name));
}

function readWorkshopBackendRecord(record: AirtableRecord): {
  workshopName: string;
  info: WorkshopBackendInfo;
  underviserNames: string[];
  hjaelpereNames: string[];
} | null {
  const workshopName = getFieldValue(record, WORKSHOPBACKEND_NAME_FIELDS);
  if (!workshopName) return null;
  const underviserRaw = getStaffFieldRaw(record, WORKSHOPBACKEND_UNDERVISER_FIELDS);
  const hjaelpereRaw = getStaffFieldRaw(record, WORKSHOPBACKEND_HJAELPERE_FIELDS);
  const underviserNames = staffNamesFromFieldValue(underviserRaw);
  const hjaelpereNames = staffNamesFromFieldValue(hjaelpereRaw);
  return {
    workshopName,
    info: {
      underviser: staffFieldDisplayValue(underviserRaw),
      hjaelpere: staffFieldDisplayValue(hjaelpereRaw),
      lokale: getFieldValue(record, WORKSHOPBACKEND_LOKALE_FIELDS),
    },
    underviserNames,
    hjaelpereNames,
  };
}

function normalizePersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseStaffNames(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function personNameMatchesStaff(adminNavn: string, staffName: string): boolean {
  const adminNorm = normalizePersonName(adminNavn);
  const staffNorm = normalizePersonName(staffName);
  if (!adminNorm || !staffNorm || staffNorm === "alle") return false;
  if (adminNorm === staffNorm) return true;
  return (
    staffNorm.startsWith(`${adminNorm} `) ||
    staffNorm.startsWith(`${adminNorm}.`) ||
    adminNorm.startsWith(`${staffNorm} `) ||
    adminNorm.startsWith(`${staffNorm}.`)
  );
}

function isAdminAssignedToParsed(
  parsed: {
    underviserNames: string[];
    hjaelpereNames: string[];
  },
  adminNavn: string
): boolean {
  if (
    staffNamesIncludeAlle(parsed.underviserNames) ||
    staffNamesIncludeAlle(parsed.hjaelpereNames)
  ) {
    return true;
  }
  return (
    adminMatchesStaffNames(adminNavn, parsed.underviserNames) ||
    adminMatchesStaffNames(adminNavn, parsed.hjaelpereNames)
  );
}

function getAdminWorkshopRolesFromParsed(
  parsed: {
    info: WorkshopBackendInfo;
    underviserNames: string[];
    hjaelpereNames: string[];
  },
  adminNavn: string
): ("underviser" | "hjaelper" | "alle")[] {
  if (
    staffNamesIncludeAlle(parsed.underviserNames) ||
    staffNamesIncludeAlle(parsed.hjaelpereNames)
  ) {
    return ["alle"];
  }
  const roles: ("underviser" | "hjaelper")[] = [];
  if (adminMatchesStaffNames(adminNavn, parsed.underviserNames)) roles.push("underviser");
  if (adminMatchesStaffNames(adminNavn, parsed.hjaelpereNames)) roles.push("hjaelper");
  return roles;
}

export function getAdminWorkshopRoles(
  backend: WorkshopBackendInfo,
  adminNavn: string
): ("underviser" | "hjaelper" | "alle")[] {
  return getAdminWorkshopRolesFromParsed(
    {
      info: backend,
      underviserNames: parseStaffNames(backend.underviser),
      hjaelpereNames: parseStaffNames(backend.hjaelpere),
    },
    adminNavn
  );
}

export async function getAssignedWorkshopOptionKeys(adminNavn: string): Promise<Set<string>> {
  const assigned = new Set<string>();
  try {
    const records = await fetchTableRecords(TABLE_WORKSHOPBACKEND);
    for (const record of records) {
      const parsed = readWorkshopBackendRecord(record);
      if (!parsed || !isAdminAssignedToParsed(parsed, adminNavn)) continue;
      assigned.add(normalizeWorkshopName(parsed.workshopName));
    }
  } catch {
    // Workshopbackend table might not exist yet
  }
  return assigned;
}

export async function adminCanAccessWorkshopOption(
  workshopOptionName: string,
  bruger: BrugerInfo
): Promise<boolean> {
  if (!bruger.isAdmin) return false;
  if (!bruger.adminNavn?.trim()) return true;
  const assigned = await getAssignedWorkshopOptionKeys(bruger.adminNavn);
  return assigned.has(normalizeWorkshopName(workshopOptionName));
}

export async function filterWorkshopCountsForAdmin<T extends { name: string }>(
  counts: T[],
  bruger: BrugerInfo
): Promise<T[]> {
  if (!bruger.isAdmin || !bruger.adminNavn?.trim()) return counts;
  const assigned = await getAssignedWorkshopOptionKeys(bruger.adminNavn);
  return counts.filter((item) => assigned.has(normalizeWorkshopName(item.name)));
}

const WORKSHOP_SLOT_KEYS = ["workshop1", "workshop2", "workshop3", "workshop4", "voksen"] as const;
export type WorkshopSlotKey = (typeof WORKSHOP_SLOT_KEYS)[number];

export interface AdminAssignedWorkshopItem {
  slot: WorkshopSlotKey;
  workshopName: string;
  count: number;
  roles: ("underviser" | "hjaelper" | "alle")[];
  underviser: string | null;
  hjaelpere: string | null;
  lokale: string | null;
}

export async function getAdminAssignedWorkshops(
  adminNavn: string
): Promise<AdminAssignedWorkshopItem[]> {
  const countByNorm = new Map<string, { slot: WorkshopSlotKey; name: string; count: number }>();
  for (const slot of WORKSHOP_SLOT_KEYS) {
    const counts = await getWorkshopCounts(slot);
    for (const item of counts) {
      countByNorm.set(normalizeWorkshopName(item.name), {
        slot,
        name: item.name,
        count: item.count,
      });
    }
  }

  const slotByNorm = new Map<string, WorkshopSlotKey>();
  try {
    const options = await getWorkshopOptions(new Date().getFullYear());
    for (const slot of WORKSHOP_SLOT_KEYS) {
      for (const name of options[slot] || []) {
        slotByNorm.set(normalizeWorkshopName(name), slot);
      }
    }
  } catch {
    // Workshopoversigt kan mangle
  }

  const results: AdminAssignedWorkshopItem[] = [];

  try {
    const records = await fetchTableRecords(TABLE_WORKSHOPBACKEND);
    for (const record of records) {
      const parsed = readWorkshopBackendRecord(record);
      if (!parsed || !isAdminAssignedToParsed(parsed, adminNavn)) continue;

      const norm = normalizeWorkshopName(parsed.workshopName);
      const registration = countByNorm.get(norm);
      const slot = registration?.slot ?? slotByNorm.get(norm) ?? "workshop1";

      results.push({
        slot,
        workshopName: registration?.name ?? parsed.workshopName,
        count: registration?.count ?? 0,
        roles: getAdminWorkshopRolesFromParsed(parsed, adminNavn),
        underviser: parsed.info.underviser,
        hjaelpere: parsed.info.hjaelpere,
        lokale: parsed.info.lokale,
      });
    }
  } catch {
    // Workshopbackend table might not exist yet
  }

  return results.sort((a, b) => {
    const slotOrder = WORKSHOP_SLOT_KEYS.indexOf(a.slot) - WORKSHOP_SLOT_KEYS.indexOf(b.slot);
    if (slotOrder !== 0) return slotOrder;
    return a.workshopName.localeCompare(b.workshopName, "da");
  });
}

function isVoksenType(type: string | null): boolean {
  return type?.trim().toLowerCase() === "voksen";
}

function formatParticipantAlder(type: string | null, alderRaw: string | null): string | null {
  if (isVoksenType(type) || !alderRaw?.trim()) return null;
  const trimmed = alderRaw.trim();
  return trimmed.endsWith("år") ? trimmed : `${trimmed} år`;
}

export async function getWorkshopParticipantsGrouped(
  workshopKey: keyof typeof WORKSHOP_FIELDS,
  workshopOptionName: string
): Promise<WorkshopFamilyGroup[]> {
  const records = await fetchAllRecords();
  const possibleNames = WORKSHOP_FIELDS[workshopKey];
  const optionNorm = workshopOptionName.trim().toLowerCase();
  const byEmail = new Map<string, WorkshopFamilyGroup>();

  for (const record of records) {
    const workshopNames = getWorkshopValues(record, possibleNames);
    const matches = workshopNames.some((w) => w.trim().toLowerCase() === optionNorm);
    if (!matches) continue;

    const email = getEmailFromRecord(record)?.trim().toLowerCase() || "ukendt";
    const navn = getFieldValue(record, NAVN_FIELDS) || "Ukendt";
    const type = getFieldValue(record, BARN_VOKSEN_FIELDS);
    const alder = formatParticipantAlder(type, getFieldValue(record, ALDER_FIELD_OPTIONS));
    const familie = getFieldValue(record, FAMILIE_FIELDS);

    let group = byEmail.get(email);
    if (!group) {
      group = { email, familie, members: [] };
      byEmail.set(email, group);
    }
    if (familie && !group.familie) group.familie = familie;

    group.members.push({ navn, alder, type });
  }

  return Array.from(byEmail.values())
    .sort((a, b) => {
      const labelA = (a.familie || a.email).toLocaleLowerCase("da");
      const labelB = (b.familie || b.email).toLocaleLowerCase("da");
      return labelA.localeCompare(labelB, "da");
    })
    .map((group) => ({
      ...group,
      members: group.members.sort((a, b) => a.navn.localeCompare(b.navn, "da")),
    }));
}

export async function getAftengruppeParticipantsGrouped(
  aftengruppeName: string
): Promise<WorkshopFamilyGroup[]> {
  const records = await fetchTableRecords(getYearTableId(getCurrentYear()));
  const optionNorm = aftengruppeName.trim().toLowerCase();
  const byEmail = new Map<string, WorkshopFamilyGroup>();

  for (const record of records) {
    const selected = getFieldValue(record, ACTIVITY_FIELD_OPTIONS.aftengrupper);
    if (!selected || selected.trim().toLowerCase() !== optionNorm) continue;

    const email = getEmailFromRecord(record)?.trim().toLowerCase() || "ukendt";
    const navn = getFieldValue(record, NAVN_FIELDS) || "Ukendt";
    const type = getFieldValue(record, BARN_VOKSEN_FIELDS);
    const alder = formatParticipantAlder(type, getFieldValue(record, ALDER_FIELD_OPTIONS));
    const familie = getFieldValue(record, FAMILIE_FIELDS);

    let group = byEmail.get(email);
    if (!group) {
      group = { email, familie, members: [] };
      byEmail.set(email, group);
    }
    if (familie && !group.familie) group.familie = familie;

    group.members.push({ navn, alder, type });
  }

  return Array.from(byEmail.values())
    .sort((a, b) => {
      const labelA = (a.familie || a.email).toLocaleLowerCase("da");
      const labelB = (b.familie || b.email).toLocaleLowerCase("da");
      return labelA.localeCompare(labelB, "da");
    })
    .map((group) => ({
      ...group,
      members: group.members.sort((a, b) => a.navn.localeCompare(b.navn, "da")),
    }));
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
const BRUGERSTATUS_FIELDS = ["Brugerstatus", "A Brugerstatus", "brugerstatus"];
const BRUGERE_NAVN_FIELDS = ["Navne", "Navn", "navn", "Name", "name"];

export interface BrugerInfo {
  recordId: string;
  code: string | null;
  isAdmin: boolean;
  adminNavn: string | null;
}

function isAdminBrugerstatus(raw: string | null): boolean {
  return raw?.trim().toLowerCase() === "admin";
}

export async function getBrugerByEmail(email: string): Promise<BrugerInfo | null> {
  try {
    const records = await fetchTableRecords(TABLE_BRUGERE);
    let fallback: BrugerInfo | null = null;
    for (const record of records) {
      const recEmail = getEmailFromRecord(record);
      if (recEmail?.toLowerCase() !== email.toLowerCase()) continue;
      const code = getFieldValue(record, KODE_FIELDS)?.trim() || null;
      const isAdmin = isAdminBrugerstatus(getFieldValue(record, BRUGERSTATUS_FIELDS));
      const adminNavn = getFieldValue(record, BRUGERE_NAVN_FIELDS)?.trim() || null;
      const info: BrugerInfo = { recordId: record.id, code, isAdmin, adminNavn };
      if (code) return info;
      fallback = info;
    }
    return fallback;
  } catch {
    // Brugere table might not exist
  }
  return null;
}

export async function getBrugerCode(email: string): Promise<string | null> {
  const bruger = await getBrugerByEmail(email);
  return bruger?.code ?? null;
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
  const bruger = await getBrugerByEmail(email);
  return bruger?.recordId ?? null;
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
  const barnVoksenFieldName = BARN_VOKSEN_FIELDS[0];
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

export interface FamilyMember {
  navn: string;
  workshop1: string | null;
  workshop2: string | null;
  workshop3: string | null;
  workshop4: string | null;
  voksen: string | null;
  aftengrupper: string | null;
  alder: number | null;
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
    const aftengrupper = getFieldValue(record, ACTIVITY_FIELD_OPTIONS.aftengrupper);
    const type = getFieldValue(record, BARN_VOKSEN_FIELDS);
    const alder = parseAge(getFieldValue(record, ALDER_FIELD_OPTIONS));

    members.push({
      navn,
      workshop1,
      workshop2,
      workshop3,
      workshop4,
      voksen,
      aftengrupper,
      alder,
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
    const aftengrupper = getFieldValue(record, ACTIVITY_FIELD_OPTIONS.aftengrupper);
    const type = getFieldValue(record, BARN_VOKSEN_FIELDS);
    const alder = parseAge(getFieldValue(record, ALDER_FIELD_OPTIONS));

    members.push({
      navn,
      workshop1,
      workshop2,
      workshop3,
      workshop4,
      voksen,
      aftengrupper,
      alder,
      type,
    });
  }

  return members;
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

function compareHoldNames(a: string, b: string): number {
  const num = (name: string) => {
    const match = name.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };
  return num(a) - num(b) || a.localeCompare(b, "da");
}

async function readFamilieloebHoldsFromAirtable(): Promise<FamilyRaceHoldView[]> {
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
  return result.sort((a, b) => compareHoldNames(a.holdnavn, b.holdnavn));
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

  const holds = await readFamilieloebHoldsFromAirtable();
  for (const hold of holds) {
    if (hold.membersText.toLowerCase().includes(`${familyName.toLowerCase()}:`)) {
      return { holdnavn: hold.holdnavn, membersText: hold.membersText };
    }
  }
  return null;
}

export async function getAllFamilieloebHolds(): Promise<FamilyRaceHoldView[]> {
  return readFamilieloebHoldsFromAirtable();
}

export async function moveFamilyBetweenFamilieloebHolds(
  familyName: string,
  fromHold: string,
  toHold: string
): Promise<FamilyRaceHoldView[]> {
  if (!familyName.trim() || !fromHold.trim() || !toHold.trim() || fromHold === toHold) {
    return readFamilieloebHoldsFromAirtable();
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
  if (idx === -1) return readFamilieloebHoldsFromAirtable();

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

  return readFamilieloebHoldsFromAirtable();
}

// --- Program-tabel (dagsprogrammer fra Airtable) ---
// Struktur: Én række per programpunkt med kolonner A Dag, A Dato, A Tid, A Titel, A Workshop

type WorkshopSlot = "workshop1" | "workshop2" | "workshop3" | "workshop4" | "voksen" | "aftengrupper" | "gyserløb" | "sheltertur";

export interface ProgramItemFromAirtable {
  tid?: string;
  titel: string;
  workshopSlot?: WorkshopSlot;
  workshops?: string[];
  aldersgrupperItem?: boolean;
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

function stripStjerneloebFromTitel(titel: string): string {
  return titel
    .replace(/\s*[-–—]\s*Stjerneløb\s*/gi, "")
    .replace(/\s*Stjerneløb\s*[-–—]?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAldersgrupperProgramTitel(titel: string): boolean {
  const t = titel.toLowerCase();
  return t.includes("aldersopdelte") || t.includes("børn i aldersgrupper");
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
        titel: isAldersgrupperProgramTitel(cleanTitel || titel)
          ? stripStjerneloebFromTitel(cleanTitel || titel)
          : cleanTitel || titel,
        workshopSlot: slot,
        workshops: workshops?.length ? workshops : undefined,
        aldersgrupperItem: isAldersgrupperProgramTitel(cleanTitel || titel) || undefined,
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
        aldersgrupperItem: next.aldersgrupperItem || curr.aldersgrupperItem,
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
        aldersgrupperItem: curr.aldersgrupperItem || next.aldersgrupperItem,
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

// --- Aldersgrupper-tabel (selvstændig torsdagsaktivitet – ikke aftengrupper-tilmelding) ---
// Struktur: Rækker "Aktiviteter" og "Navne", kolonner = gruppenavne (fx "Gruppe 1: 3-5 år")

const ALDERSGRUPPER_ROW_LABEL_FIELDS = ["Aktiviteter", "Type", "Række", "Rad", "Row"];

async function fetchAldersgrupperRecords(): Promise<AirtableRecord[]> {
  for (const tableName of ALDERSGRUPPER_TABLE_NAMES) {
    try {
      const records = await fetchTableRecords(tableName);
      if (records.length > 0) return records;
    } catch {
      // Prøv næste tabelnavn
    }
  }
  return [];
}

export interface AldersgruppeDefinition {
  name: string;
  activities: string[];
  participantNamesRaw: string;
  ageMin: number | null;
  ageMax: number | null;
}

function readRecordField(record: AirtableRecord, fieldName: string): string | null {
  const value = record.fields[fieldName];
  if (value == null || value === "") return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value) && value.length > 0) {
    return (typeof value[0] === "string" ? value[0] : String(value[0])).trim() || null;
  }
  return String(value).trim() || null;
}

function parseActivitiesText(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.includes("\n")) {
    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [trimmed];
}

function normalizeGroupKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function groupSortKey(name: string): number {
  const match = name.match(/gruppe\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : 999;
}

function parseGroupAgeRange(groupName: string): { min: number; max: number } | null {
  const rangeMatch = groupName.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return { min: parseInt(rangeMatch[1], 10), max: parseInt(rangeMatch[2], 10) };
  }
  const plusMatch = groupName.match(/(\d+)\s*\+/);
  if (plusMatch) {
    return { min: parseInt(plusMatch[1], 10), max: 99 };
  }
  return null;
}

function getMemberFirstName(navn: string): string {
  return navn.trim().split(/\s+/)[0]?.toLowerCase() || "";
}

function parseGroupParticipantNames(namesRaw: string): Map<string, number | null> {
  const participants = new Map<string, number | null>();
  let remaining = namesRaw;

  const withAgePattern = /\b([A-Za-zÀ-ÿæøåÆØÅ\-]+)\s*\((\d+)(?:\s*år)?\)/g;
  let ageMatch: RegExpExecArray | null;
  while ((ageMatch = withAgePattern.exec(namesRaw)) !== null) {
    participants.set(ageMatch[1].toLowerCase(), parseInt(ageMatch[2], 10));
    remaining = remaining.replace(ageMatch[0], " ");
  }

  for (const token of remaining.split(/\s+/)) {
    const name = token.replace(/[^A-Za-zÀ-ÿæøåÆØÅ\-]/g, "");
    if (name.length < 2) continue;
    const key = name.toLowerCase();
    if (!participants.has(key)) {
      participants.set(key, null);
    }
  }

  return participants;
}

function ageMatchesGroupRange(memberAge: number, group: AldersgruppeDefinition): boolean {
  if (group.ageMin === null || group.ageMax === null) return true;
  return memberAge >= group.ageMin && memberAge <= group.ageMax;
}

function memberMatchesAldersgruppe(member: FamilyMember, group: AldersgruppeDefinition): boolean {
  const firstName = getMemberFirstName(member.navn);
  if (!firstName) return false;

  const participants = parseGroupParticipantNames(group.participantNamesRaw);
  if (!participants.has(firstName)) return false;

  const inlineAge = participants.get(firstName);
  const memberAge = member.alder;

  if (inlineAge !== null && inlineAge !== undefined) {
    return memberAge === inlineAge;
  }

  if (memberAge !== null) {
    return ageMatchesGroupRange(memberAge, group);
  }

  return true;
}

function findAldersgruppeForMember(
  member: FamilyMember,
  groups: AldersgruppeDefinition[]
): AldersgruppeDefinition | undefined {
  const firstName = getMemberFirstName(member.navn);
  const candidates = groups.filter((group) => memberMatchesAldersgruppe(member, group));

  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  if (member.alder !== null) {
    const inlineMatches = candidates.filter((group) => {
      const inlineAge = parseGroupParticipantNames(group.participantNamesRaw).get(firstName);
      return inlineAge !== null && inlineAge !== undefined && inlineAge === member.alder;
    });
    if (inlineMatches.length === 1) return inlineMatches[0];

    const rangeMatches = candidates.filter((group) => ageMatchesGroupRange(member.alder!, group));
    if (rangeMatches.length === 1) return rangeMatches[0];
  }

  return undefined;
}

export function nameAppearsInGroupList(memberNavn: string, namesRaw: string): boolean {
  const target = memberNavn.trim().toLowerCase();
  const firstName = target.split(/\s+/)[0];
  if (!firstName) return false;

  const normalized = namesRaw.toLowerCase();
  const pattern = new RegExp(`(?:^|[\\s,(])${firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$|[,(])`, "i");
  return pattern.test(normalized);
}

export async function getAldersgrupperDefinitions(): Promise<AldersgruppeDefinition[]> {
  const records = await fetchAldersgrupperRecords();
  if (records.length === 0) return [];

  let aktiviteterRec: AirtableRecord | null = null;
  let navneRec: AirtableRecord | null = null;

  for (const rec of records) {
    const label = getFieldValue(rec, ALDERSGRUPPER_ROW_LABEL_FIELDS)?.trim().toLowerCase();
    if (label === "aktiviteter") aktiviteterRec = rec;
    if (label === "navne") navneRec = rec;
  }

  const sampleRec = aktiviteterRec || navneRec || records[0];
  const groupFieldNames = Object.keys(sampleRec.fields).filter(
    (field) => !ALDERSGRUPPER_ROW_LABEL_FIELDS.includes(field)
  );

  const groups: AldersgruppeDefinition[] = [];
  for (const fieldName of groupFieldNames) {
    const activitiesRaw = aktiviteterRec ? readRecordField(aktiviteterRec, fieldName) : null;
    const namesRaw = navneRec ? readRecordField(navneRec, fieldName) : null;
    if (!activitiesRaw && !namesRaw) continue;

    const range = parseGroupAgeRange(fieldName);
    groups.push({
      name: fieldName.trim(),
      activities: parseActivitiesText(activitiesRaw || ""),
      participantNamesRaw: namesRaw || "",
      ageMin: range?.min ?? null,
      ageMax: range?.max ?? null,
    });
  }

  return groups.sort((a, b) => groupSortKey(a.name) - groupSortKey(b.name));
}

export interface FamilyAldersgruppeBlock {
  gruppeNavn: string;
  børn: string[];
  aktiviteter: string[];
}

export function buildFamilyAldersgruppeBlocks(
  members: FamilyMember[],
  groups: AldersgruppeDefinition[]
): FamilyAldersgruppeBlock[] {
  const byGroup = new Map<string, { gruppeNavn: string; børn: string[]; aktiviteter: string[] }>();

  for (const member of members) {
    const type = member.type?.trim().toLowerCase() || "";
    if (type.includes("voksen") || type.includes("forældre")) continue;

    const matchedGroup = findAldersgruppeForMember(member, groups);

    if (!matchedGroup) continue;

    const key = normalizeGroupKey(matchedGroup.name);
    let block = byGroup.get(key);
    if (!block) {
      block = {
        gruppeNavn: matchedGroup.name,
        børn: [],
        aktiviteter: matchedGroup.activities,
      };
      byGroup.set(key, block);
    }
    if (!block.børn.includes(member.navn)) {
      block.børn.push(member.navn);
    }
  }

  return Array.from(byGroup.values()).sort(
    (a, b) => groupSortKey(a.gruppeNavn) - groupSortKey(b.gruppeNavn)
  );
}

export function formatAldersgruppeBeskrivelse(blocks: FamilyAldersgruppeBlock[]): string {
  return blocks
    .map((block) => {
      const lines = [
        `${block.gruppeNavn}: ${block.børn.join(", ")}`,
        "Aktiviteter:",
        ...block.aktiviteter,
        "",
      ];
      return lines.join("\n");
    })
    .join("\n")
    .trim();
}

// --- Mød os-tabel (navn/billede-overrides; fallback til statiske filer i public/) ---

const MOED_OS_SLUG_FIELDS = ["Slug", "slug"];
const MOED_OS_NAVN_FIELDS = ["Navn", "Name", "navn", "name"];
const MOED_OS_BILLEDE_FIELDS = ["Billede", "Photo", "Image", "billede"];
const MOED_OS_EMAIL_FIELDS = ["Email", "A Email", "email"];

export interface MoedOsAirtableOverride {
  slug: string;
  name: string;
  image: string;
  recordId: string;
  linkedEmail: string | null;
}

function getAttachmentUrl(record: AirtableRecord, fieldNames: string[]): string | null {
  for (const fieldName of fieldNames) {
    const value = record.fields[fieldName];
    if (!Array.isArray(value) || value.length === 0) continue;
    const first = value[0];
    if (typeof first === "object" && first !== null && "url" in first) {
      const url = (first as { url?: string }).url;
      if (url?.trim()) return url.trim();
    }
  }
  return null;
}

export async function getMoedOsAirtableOverrides(): Promise<Map<string, MoedOsAirtableOverride>> {
  const overrides = new Map<string, MoedOsAirtableOverride>();
  try {
    const records = await fetchTableRecords(TABLE_MOED_OS);
    for (const record of records) {
      const slug = getFieldValue(record, MOED_OS_SLUG_FIELDS)?.trim().toLowerCase();
      if (!slug) continue;
      const name = getFieldValue(record, MOED_OS_NAVN_FIELDS);
      const image = getAttachmentUrl(record, MOED_OS_BILLEDE_FIELDS);
      if (!name && !image) continue;
      overrides.set(slug, {
        slug,
        name: name || slug,
        image: image || "",
        recordId: record.id,
        linkedEmail: getFieldValue(record, MOED_OS_EMAIL_FIELDS),
      });
    }
  } catch {
    // Tabellen findes måske ikke endnu
  }
  return overrides;
}

export async function upsertMoedOsAirtableRecord(
  slug: string,
  fields: { name?: string; imageUrl?: string; linkedEmail?: string | null }
): Promise<string> {
  const normalizedSlug = slug.trim().toLowerCase();
  const overrides = await getMoedOsAirtableOverrides();
  const existing = overrides.get(normalizedSlug);

  const fieldNames = await getTableFieldNames(TABLE_MOED_OS);
  const slugField = resolveFieldName(fieldNames, MOED_OS_SLUG_FIELDS);
  const navnField = resolveFieldName(fieldNames, MOED_OS_NAVN_FIELDS);
  const billedeField = resolveFieldName(fieldNames, MOED_OS_BILLEDE_FIELDS);
  const emailField = resolveFieldName(fieldNames, MOED_OS_EMAIL_FIELDS);

  const payload: Record<string, unknown> = {
    [slugField]: normalizedSlug,
  };
  if (fields.name?.trim()) payload[navnField] = fields.name.trim();
  if (fields.imageUrl?.trim()) payload[billedeField] = [{ url: fields.imageUrl.trim() }];
  if (fields.linkedEmail !== undefined) {
    payload[emailField] = fields.linkedEmail?.trim() || "";
  }

  if (existing?.recordId) {
    await updateAirtableRecord(TABLE_MOED_OS, existing.recordId, payload);
    return existing.recordId;
  }

  const created = await createAirtableRecord(TABLE_MOED_OS, payload);
  return created.id;
}
