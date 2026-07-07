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

const OUTPUT_PATH = path.join(process.cwd(), "workshop-oversigt-a3.xlsx");
const NAME_COLUMNS = 12;

const WORKSHOP_KEYS = [
  { key: "workshop1" as const, label: "Workshop 1" },
  { key: "workshop2" as const, label: "Workshop 2" },
  { key: "workshop3" as const, label: "Workshop 3" },
  { key: "workshop4" as const, label: "Workshop 4" },
  { key: "voksen" as const, label: "Workshop Forældre" },
];

interface WorkshopSheetData {
  sheetTitle: string;
  displayTitle: string;
  slotLabel: string;
  workshopName: string;
  firstNames: string[];
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return trimmed;
  return trimmed.split(/\s+/)[0];
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, " ").trim();
  return cleaned.length > 31 ? cleaned.slice(0, 31).trim() : cleaned || "Workshop";
}

function uniqueSheetName(base: string, used: Set<string>): string {
  let candidate = sanitizeSheetName(base);
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let i = 2;
  while (i < 100) {
    const suffix = ` (${i})`;
    const trimmed = sanitizeSheetName(base).slice(0, 31 - suffix.length) + suffix;
    if (!used.has(trimmed)) {
      used.add(trimmed);
      return trimmed;
    }
    i += 1;
  }
  const fallback = `Ark ${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

function a3LandscapePageSetup(sheet: ExcelJS.Worksheet) {
  sheet.pageSetup = {
    paperSize: 8,
    orientation: "landscape",
    fitToPage: false,
    horizontalCentered: true,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };
  sheet.headerFooter.oddHeader = "&C&\"Arial,Bold\"Familiekursus 2026 – workshopdeltagere";
  sheet.headerFooter.oddFooter = "&C&P / &N";
}

function styleTitleCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 18, color: { argb: "FF1E293B" } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
}

function styleMetaCell(cell: ExcelJS.Cell) {
  cell.font = { size: 11, color: { argb: "FF475569" } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
}

function styleNameCell(cell: ExcelJS.Cell) {
  cell.font = { size: 11, color: { argb: "FF0F172A" } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  cell.border = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };
}

async function collectWorkshopSheets(): Promise<WorkshopSheetData[]> {
  const {
    getWorkshopCounts,
    getAftengrupperOptionsDetailed,
    getAftengruppeParticipantsGrouped,
  } = await import("../src/lib/airtable");

  const sheets: WorkshopSheetData[] = [];

  for (const { key, label } of WORKSHOP_KEYS) {
    const counts = await getWorkshopCounts(key, true);
    for (const { name, participants } of counts) {
      if (!name.trim()) continue;
      const firstNames = Array.from(
        new Set((participants ?? []).map(firstName).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "da"));
      sheets.push({
        sheetTitle: `${label} ${name}`,
        displayTitle: name,
        slotLabel: label,
        workshopName: name,
        firstNames,
      });
    }
  }

  const aftengrupper = await getAftengrupperOptionsDetailed();
  for (const gruppe of aftengrupper) {
    if (!gruppe.name.trim()) continue;
    const families = await getAftengruppeParticipantsGrouped(gruppe.name);
    const firstNames = Array.from(
      new Set(
        families.flatMap((family) => family.members.map((member) => firstName(member.navn))).filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "da"));
    sheets.push({
      sheetTitle: `Aftengruppe ${gruppe.name}`,
      displayTitle: gruppe.name,
      slotLabel: "Aftengruppe",
      workshopName: gruppe.name,
      firstNames,
    });
  }

  return sheets.sort(
    (a, b) =>
      a.slotLabel.localeCompare(b.slotLabel, "da") ||
      a.workshopName.localeCompare(b.workshopName, "da")
  );
}

function buildWorkshopSheet(workbook: ExcelJS.Workbook, sheetName: string, data: WorkshopSheetData) {
  const sheet = workbook.addWorksheet(sheetName);
  const totalCols = NAME_COLUMNS;

  for (let c = 1; c <= totalCols; c += 1) {
    sheet.getColumn(c).width = 11;
  }

  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = data.displayTitle;
  styleTitleCell(titleCell);
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, totalCols);
  const metaCell = sheet.getCell(2, 1);
  metaCell.value = `${data.slotLabel} · ${data.firstNames.length} deltagere · fornavne`;
  styleMetaCell(metaCell);
  sheet.getRow(2).height = 18;

  const startRow = 4;
  const rowCount = Math.max(1, Math.ceil(data.firstNames.length / totalCols));

  for (let r = 0; r < rowCount; r += 1) {
    const row = sheet.getRow(startRow + r);
    row.height = 20;
    for (let c = 0; c < totalCols; c += 1) {
      const idx = r * totalCols + c;
      const cell = row.getCell(c + 1);
      cell.value = idx < data.firstNames.length ? data.firstNames[idx] : "";
      styleNameCell(cell);
    }
  }

  sheet.views = [{ state: "frozen", ySplit: 3 }];
  a3LandscapePageSetup(sheet);
}

function buildOverviewSheet(workbook: ExcelJS.Workbook, sheets: WorkshopSheetData[]) {
  const sheet = workbook.addWorksheet("Oversigt", { properties: { tabColor: { argb: "FFF59E0B" } } });
  sheet.columns = [
    { width: 22 },
    { width: 36 },
    { width: 12 },
    { width: 18 },
  ];

  sheet.mergeCells("A1:D1");
  const title = sheet.getCell("A1");
  title.value = "Workshopoversigt – Familiekursus 2026";
  styleTitleCell(title);
  sheet.getRow(1).height = 28;

  const header = sheet.getRow(3);
  header.values = ["Tidsrum", "Workshop", "Antal", "Ark"];
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
  });

  sheets.forEach((entry, index) => {
    const row = sheet.getRow(4 + index);
    row.values = [entry.slotLabel, entry.workshopName, entry.firstNames.length, entry.sheetTitle];
    row.height = 18;
  });

  a3LandscapePageSetup(sheet);
}

async function main() {
  const sheets = await collectWorkshopSheets();
  if (sheets.length === 0) {
    throw new Error("Ingen workshops fundet i Airtable.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Familiekursus";
  workbook.created = new Date();

  buildOverviewSheet(workbook, sheets);

  const usedSheetNames = new Set<string>(["Oversigt"]);
  for (const data of sheets) {
    const sheetName = uniqueSheetName(data.sheetTitle, usedSheetNames);
    buildWorkshopSheet(workbook, sheetName, data);
  }

  await workbook.xlsx.writeFile(OUTPUT_PATH);

  const totalNames = sheets.reduce((sum, sheet) => sum + sheet.firstNames.length, 0);
  console.log(`Excel oprettet: ${OUTPUT_PATH}`);
  console.log(`${sheets.length} workshops/aftengrupper, ${totalNames} fornavne i alt.`);
  console.log("Print: vælg A3, vandret (landskab), ét ark per faneblad.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
