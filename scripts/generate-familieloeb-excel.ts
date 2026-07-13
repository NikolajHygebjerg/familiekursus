import ExcelJS from "exceljs";
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

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

interface Participant {
  holdnavn: string;
  familie: string;
  navn: string;
  alder: number | null;
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

function holdNumber(holdnavn: string): number {
  const match = holdnavn.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
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

function collectParticipants(records: AirtableRecord[]): Participant[] {
  const participants: Participant[] = [];
  for (const record of records) {
    const holdnavn = getField(record, ["Familieløb"]);
    const familie = getField(record, ["Familie", "familie"]);
    const navn = getField(record, ["Navn", "navn"]);
    if (!holdnavn || !familie || !navn) continue;
    participants.push({
      holdnavn,
      familie,
      navn,
      alder: parseAge(getField(record, ["Alder", "A Alder"])),
    });
  }
  return participants.sort(
    (a, b) =>
      holdNumber(a.holdnavn) - holdNumber(b.holdnavn) ||
      a.familie.localeCompare(b.familie, "da") ||
      a.navn.localeCompare(b.navn, "da")
  );
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, size: 12 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2F0D9" },
  };
  row.alignment = { vertical: "middle" };
}

function styleHoldTitle(row: ExcelJS.Row) {
  row.font = { bold: true, size: 14 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9EAF7" },
  };
}

function styleFamilyRow(row: ExcelJS.Row) {
  row.font = { bold: true };
}

async function buildWorkbook(participants: Participant[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Familiekursus";
  workbook.created = new Date();

  const overview = workbook.addWorksheet("Oversigt");
  overview.columns = [
    { header: "Hold", key: "hold", width: 12 },
    { header: "Familier", key: "familier", width: 12 },
    { header: "Deltagere", key: "deltagere", width: 12 },
    { header: "Børns aldre", key: "aldre", width: 24 },
  ];
  styleHeaderRow(overview.getRow(1));

  const listSheet = workbook.addWorksheet("Alle hold");
  listSheet.columns = [
    { header: "Hold", key: "hold", width: 10 },
    { header: "Familie", key: "familie", width: 28 },
    { header: "Navn", key: "navn", width: 30 },
    { header: "Alder", key: "alder", width: 8 },
  ];
  styleHeaderRow(listSheet.getRow(1));

  const byHold = new Map<string, Participant[]>();
  for (const participant of participants) {
    const list = byHold.get(participant.holdnavn) || [];
    list.push(participant);
    byHold.set(participant.holdnavn, list);
  }

  for (const [holdnavn, members] of [...byHold.entries()].sort(
    (a, b) => holdNumber(a[0]) - holdNumber(b[0])
  )) {
    const families = new Set(members.map((member) => member.familie));
    const ages = members
      .map((member) => member.alder)
      .filter((age): age is number => age != null)
      .sort((a, b) => a - b);
    const ageText = ages.length > 0 ? `${ages[0]}–${ages[ages.length - 1]} år` : "—";

    overview.addRow({
      hold: holdnavn,
      familier: families.size,
      deltagere: members.length,
      aldre: ageText,
    });

    const sheetName = holdnavn.replace("Hold ", "Hold ");
    const sheet = workbook.addWorksheet(sheetName.length > 31 ? holdnavn.slice(0, 31) : sheetName);
    sheet.columns = [
      { header: "Familie", key: "familie", width: 30 },
      { header: "Navn", key: "navn", width: 32 },
      { header: "Alder", key: "alder", width: 10 },
    ];
    styleHeaderRow(sheet.getRow(1));

    const title = sheet.addRow([`${holdnavn} — ${members.length} deltagere`, "", ""]);
    sheet.mergeCells(title.number, 1, title.number, 3);
    styleHoldTitle(title);

    let currentFamily = "";
    for (const member of members) {
      if (member.familie !== currentFamily) {
        currentFamily = member.familie;
        const familyRow = sheet.addRow([member.familie, "", ""]);
        sheet.mergeCells(familyRow.number, 1, familyRow.number, 3);
        styleFamilyRow(familyRow);
      }
      sheet.addRow({
        familie: "",
        navn: member.navn,
        alder: member.alder ?? "",
      });
      listSheet.addRow({
        hold: holdnavn,
        familie: member.familie,
        navn: member.navn,
        alder: member.alder ?? "",
      });
    }

    sheet.pageSetup = {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      },
    };
    sheet.headerFooter = {
      oddHeader: `&C${holdnavn}`,
      oddFooter: "&RSide &P af &N",
    };
  }

  overview.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1 };
  listSheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1 };

  return workbook;
}

async function main() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) throw new Error("AIRTABLE_API_KEY mangler");

  const outputArg = process.argv.find((arg) => arg.startsWith("--out="));
  const outputPath =
    outputArg?.slice("--out=".length) ||
    path.join(process.env.HOME || "", "Downloads", "Familieløb-hold-udprint.xlsx");

  const records = await fetchAllRecords(apiKey);
  const participants = collectParticipants(records);
  if (participants.length === 0) {
    throw new Error("Ingen deltagere med Familieløb-hold fundet i Airtable.");
  }

  const workbook = await buildWorkbook(participants);
  await workbook.xlsx.writeFile(outputPath);

  const holdCount = new Set(participants.map((participant) => participant.holdnavn)).size;
  console.log(`Excel oprettet: ${outputPath}`);
  console.log(`${holdCount} hold, ${participants.length} deltagere.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
