import {
  WORKSHOP_FIELDS,
  type WorkshopSlotKey,
  normalizeWorkshopName,
  normalizeLoginName,
  getYearTableId,
  type AirtableRecord,
} from "@/lib/airtable";
import { fetchFkRecords, normalizeTableKey } from "@/lib/fk-records";
import { getKursusYear } from "@/lib/kursus-year";
import {
  WORKSHOP_KAPACITET,
  type WorkshopCapacityUnit,
  type WorkshopCapacitySpec,
} from "@/data/workshop-kapacitet";

const TABLE_WORKSHOPOVERSIGT = "Workshopoversigt";
const WORKSHOPOVERSIGT_MAX_FIELDS = ["# Max", "Max", "A Max", "Maks antal", "A Maks antal"];
const WORKSHOPOVERSIGT_OPTION_FIELDS: Record<string, string[]> = {
  workshop1: ["A Workshop 1", "Workshop 1"],
  workshop2: ["A Workshop 2", "Workshop 2"],
  workshop3: ["A Workshop 3", "Workshop 3"],
  workshop4: ["A Workshop 4", "Workshop 4"],
  voksen: ["Forældreworkshop", "A Forældreworkshop", "A Workshop Forældre", "Workshop Forældre"],
};
const FAMILIE_FIELDS = ["Familie", "familie", "Family", "family"];
const BRUGERNAVN_FIELDS = ["Brugernavn", "brugernavn", "Login", "login"];
const EMAIL_FIELDS = ["Email", "email", "A Email"];
const NAVN_FIELDS = ["Navn", "navn", "Name", "name"];

function getFieldValue(record: AirtableRecord, possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    if (!(name in record.fields)) continue;
    const value = record.fields[name];
    if (value == null || value === "") continue;
    if (typeof value === "string") return value.trim() || null;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      return (typeof first === "string" ? first : String(first)).trim() || null;
    }
    return String(value).trim() || null;
  }
  return null;
}

function getWorkshopValues(record: AirtableRecord, possibleNames: string[]): string[] {
  for (const name of possibleNames) {
    if (name in record.fields && record.fields[name]) {
      const value = record.fields[name];
      if (typeof value === "string") return value.trim() ? [value.trim()] : [];
      if (Array.isArray(value)) {
        return value
          .map((v) => (typeof v === "string" ? v.trim() : String(v).trim()))
          .filter(Boolean);
      }
      return [String(value).trim()].filter(Boolean);
    }
  }
  return [];
}

function getFirstWorkshopValue(record: AirtableRecord, possibleNames: string[]): string | null {
  const values = getWorkshopValues(record, possibleNames);
  return values.length > 0 ? values[0] : null;
}

export interface WorkshopOptionDetail {
  name: string;
  max: number | null;
  current: number;
  remaining: number | null;
  soldOut: boolean;
  unit: WorkshopCapacityUnit;
}

export interface WorkshopCapacityConflict {
  slot: WorkshopSlotKey;
  workshopName: string;
  requested: number;
  available: number;
  unit: WorkshopCapacityUnit;
  memberNames: string[];
}

/** Én post per workshop (ignorerer tomme mellemrum og skrivemåder med samme normaliserede navn). */
export function uniqueWorkshopDisplayNames(names: string[]): string[] {
  const byNorm = new Map<string, string>();
  for (const raw of names) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const norm = normalizeWorkshopName(trimmed);
    const prev = byNorm.get(norm);
    if (!prev || trimmed.localeCompare(prev, "da") < 0) {
      byNorm.set(norm, trimmed);
    }
  }
  return Array.from(byNorm.values());
}

function parseMaxWithUnit(raw: string | null): { max: number | null; unit: WorkshopCapacityUnit } {
  if (!raw?.trim()) return { max: null, unit: "person" };
  const lower = raw.toLowerCase();
  const unit: WorkshopCapacityUnit = lower.includes("famil") ? "family" : "person";
  const match = raw.match(/[\d]+(?:[.,]\d+)?/);
  const max = match ? parseFloat(match[0].replace(",", ".")) : null;
  return { max: max !== null && Number.isFinite(max) ? max : null, unit };
}

function fallbackSpec(slot: WorkshopSlotKey, displayName: string): WorkshopCapacitySpec | null {
  if (slot === "voksen") return null;
  const slotMap = WORKSHOP_KAPACITET[slot];
  if (!slotMap) return null;
  if (slotMap[displayName]) return slotMap[displayName];
  const norm = normalizeWorkshopName(displayName);
  for (const [name, spec] of Object.entries(slotMap)) {
    if (normalizeWorkshopName(name) === norm) return spec;
  }
  return null;
}

function loginKeyFromRecord(record: AirtableRecord): string {
  const raw =
    getFieldValue(record, BRUGERNAVN_FIELDS) ||
    getFieldValue(record, EMAIL_FIELDS) ||
    getFieldValue(record, FAMILIE_FIELDS);
  return raw ? normalizeLoginName(raw).toLowerCase() : "";
}

async function fetchYearRecords(): Promise<AirtableRecord[]> {
  const tableKey = normalizeTableKey(getYearTableId(getKursusYear()));
  const rows = await fetchFkRecords(tableKey);
  return rows.map((r) => ({ id: r.id, fields: r.fields }));
}

async function fetchWorkshopoversigtRecords(): Promise<AirtableRecord[]> {
  const rows = await fetchFkRecords(TABLE_WORKSHOPOVERSIGT);
  return rows.map((r) => ({ id: r.id, fields: r.fields }));
}

export async function buildWorkshopCapacityIndex(): Promise<
  Map<string, { max: number | null; unit: WorkshopCapacityUnit }>
> {
  const index = new Map<string, { max: number | null; unit: WorkshopCapacityUnit }>();
  try {
    const records = await fetchWorkshopoversigtRecords();
    for (const rec of records) {
      for (const slot of Object.keys(WORKSHOPOVERSIGT_OPTION_FIELDS) as WorkshopSlotKey[]) {
        const names = getWorkshopValues(rec, WORKSHOPOVERSIGT_OPTION_FIELDS[slot]);
        if (names.length === 0) continue;
        const parsed = parseMaxWithUnit(getFieldValue(rec, WORKSHOPOVERSIGT_MAX_FIELDS));
        for (const name of names) {
          const trimmed = name.trim();
          if (!trimmed) continue;
          const key = `${slot}::${normalizeWorkshopName(trimmed)}`;
          if (!index.has(key)) {
            index.set(key, { max: parsed.max, unit: parsed.unit });
          }
        }
      }
    }
  } catch {
    // Workshopoversigt kan mangle
  }

  for (const slot of Object.keys(WORKSHOP_KAPACITET) as Exclude<WorkshopSlotKey, "voksen">[]) {
    for (const [name, spec] of Object.entries(WORKSHOP_KAPACITET[slot])) {
      const key = `${slot}::${normalizeWorkshopName(name)}`;
      const existing = index.get(key);
      if (!existing || existing.max === null) {
        index.set(key, { max: spec.max, unit: spec.unit });
      }
    }
  }

  return index;
}

export async function countWorkshopRegistrations(
  slot: WorkshopSlotKey,
  workshopDisplayName: string,
  unit: WorkshopCapacityUnit,
  excludeRecordIds: Set<string> = new Set()
): Promise<number> {
  const targetNorm = normalizeWorkshopName(workshopDisplayName);
  const records = await fetchYearRecords();
  const possibleNames = WORKSHOP_FIELDS[slot];

  if (unit === "person") {
    let count = 0;
    for (const record of records) {
      if (excludeRecordIds.has(record.id)) continue;
      const values = getWorkshopValues(record, possibleNames);
      if (values.some((v) => normalizeWorkshopName(v) === targetNorm)) count += 1;
    }
    return count;
  }

  const families = new Set<string>();
  for (const record of records) {
    if (excludeRecordIds.has(record.id)) continue;
    const values = getWorkshopValues(record, possibleNames);
    if (!values.some((v) => normalizeWorkshopName(v) === targetNorm)) continue;
    const key = loginKeyFromRecord(record);
    if (key) families.add(key);
  }
  return families.size;
}

export async function getWorkshopOptionDetail(
  slot: WorkshopSlotKey,
  workshopDisplayName: string,
  capacityIndex?: Map<string, { max: number | null; unit: WorkshopCapacityUnit }>
): Promise<WorkshopOptionDetail> {
  const index = capacityIndex ?? (await buildWorkshopCapacityIndex());
  const norm = normalizeWorkshopName(workshopDisplayName);
  const key = `${slot}::${norm}`;
  const fromIndex = index.get(key);
  const fallback = fallbackSpec(slot, workshopDisplayName);
  const unit = fromIndex?.unit ?? fallback?.unit ?? "person";
  const max = fromIndex?.max ?? fallback?.max ?? null;
  const current = await countWorkshopRegistrations(slot, workshopDisplayName, unit);
  const remaining = max !== null ? Math.max(0, max - current) : null;
  return {
    name: workshopDisplayName,
    max,
    current,
    remaining,
    soldOut: max !== null ? current >= max : false,
    unit,
  };
}

export async function getWorkshopSlotOptionsDetailed(
  slot: WorkshopSlotKey
): Promise<WorkshopOptionDetail[]> {
  const { getWorkshopOptions } = await import("@/lib/airtable");
  const options = await getWorkshopOptions(getKursusYear());
  const names = uniqueWorkshopDisplayNames(options[slot] || []);
  const index = await buildWorkshopCapacityIndex();
  const detailed: WorkshopOptionDetail[] = [];
  for (const name of names) {
    detailed.push(await getWorkshopOptionDetail(slot, name, index));
  }
  return detailed.sort((a, b) => a.name.localeCompare(b.name, "da"));
}

export async function getAllWorkshopOptionsDetailed(): Promise<
  Record<WorkshopSlotKey, WorkshopOptionDetail[]>
> {
  const slots: WorkshopSlotKey[] = ["workshop1", "workshop2", "workshop3", "workshop4", "voksen"];
  const result = {} as Record<WorkshopSlotKey, WorkshopOptionDetail[]>;
  const index = await buildWorkshopCapacityIndex();
  const { getWorkshopOptions } = await import("@/lib/airtable");
  const options = await getWorkshopOptions(getKursusYear());
  for (const slot of slots) {
    const fromDb = options[slot] || [];
    const fromFallback =
      slot !== "voksen" && slot in WORKSHOP_KAPACITET
        ? Object.keys(WORKSHOP_KAPACITET[slot as keyof typeof WORKSHOP_KAPACITET])
        : [];
  const names = uniqueWorkshopDisplayNames([...fromDb, ...fromFallback]);
    const list: WorkshopOptionDetail[] = [];
    for (const name of names) {
      list.push(await getWorkshopOptionDetail(slot, name, index));
    }
    result[slot] = list.sort((a, b) => a.name.localeCompare(b.name, "da"));
  }
  return result;
}

function recordWorkshopInSlot(record: AirtableRecord, slot: WorkshopSlotKey): string | null {
  return getFirstWorkshopValue(record, WORKSHOP_FIELDS[slot]);
}

export async function familyAlreadyInWorkshop(
  login: string,
  slot: WorkshopSlotKey,
  workshopDisplayName: string
): Promise<boolean> {
  const targetNorm = normalizeWorkshopName(workshopDisplayName);
  const loginNorm = normalizeLoginName(login).toLowerCase();
  const records = await fetchYearRecords();
  for (const record of records) {
    const key = loginKeyFromRecord(record);
    if (key !== loginNorm) continue;
    const w = recordWorkshopInSlot(record, slot);
    if (w && normalizeWorkshopName(w) === targetNorm) return true;
  }
  return false;
}

export async function validateWorkshopPicksForLogin(
  login: string,
  picks: Array<{ navn: string; slot: WorkshopSlotKey; workshop: string }>,
  recordIdsByNavn: Map<string, string>
): Promise<WorkshopCapacityConflict[]> {
  const index = await buildWorkshopCapacityIndex();
  const conflicts: WorkshopCapacityConflict[] = [];

  const bySlotWorkshop = new Map<string, { slot: WorkshopSlotKey; workshop: string; members: string[] }>();
  for (const pick of picks) {
    if (!pick.workshop?.trim()) continue;
    const k = `${pick.slot}::${normalizeWorkshopName(pick.workshop)}`;
    const group = bySlotWorkshop.get(k) || {
      slot: pick.slot,
      workshop: pick.workshop.trim(),
      members: [],
    };
    group.members.push(pick.navn);
    bySlotWorkshop.set(k, group);
  }

  for (const { slot, workshop, members } of Array.from(bySlotWorkshop.values())) {
    const detail = await getWorkshopOptionDetail(slot, workshop, index);
    if (detail.max === null) continue;

    const exclude = new Set<string>();
    for (const navn of members) {
      const id = recordIdsByNavn.get(navn.toLowerCase());
      if (id) exclude.add(id);
    }

    const unit = detail.unit;
    let needed = 0;
    if (unit === "person") {
      needed = members.length;
    } else {
      const already = await familyAlreadyInWorkshop(login, slot, workshop);
      needed = already ? 0 : 1;
    }

    if (needed === 0) continue;

    const current = await countWorkshopRegistrations(slot, workshop, unit, exclude);
    const available = Math.max(0, detail.max - current);
    if (needed > available) {
      conflicts.push({
        slot,
        workshopName: workshop,
        requested: unit === "family" ? 1 : members.length,
        available,
        unit,
        memberNames: members,
      });
    }
  }

  return conflicts;
}
