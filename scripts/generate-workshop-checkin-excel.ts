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

const MOBILEPAY_NUMBER = "848081";
const OUTPUT_PATH = path.join(
  process.cwd(),
  "workshop-tjeklister-mobilepay.xlsx"
);

const WORKSHOP_KEYS = ["workshop1", "workshop2", "workshop3", "workshop4", "voksen"] as const;

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

async function collectWorkshops(): Promise<Map<string, string[]>> {
  const { getWorkshopCounts } = await import("../src/lib/airtable");
  const workshops = new Map<string, Set<string>>();

  for (const key of WORKSHOP_KEYS) {
    const counts = await getWorkshopCounts(key, true);
    for (const { name, participants } of counts) {
      if (!name.trim()) continue;
      let set = workshops.get(name);
      if (!set) {
        set = new Set<string>();
        workshops.set(name, set);
      }
      for (const participant of participants ?? []) {
        if (participant.trim()) set.add(participant.trim());
      }
    }
  }

  const result = new Map<string, string[]>();
  workshops.forEach((set, name) => {
    result.set(
      name,
      Array.from(set).sort((a, b) => a.localeCompare(b, "da"))
    );
  });
  return result;
}

function styleTitleCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 16, color: { argb: "FF1E293B" } };
  cell.alignment = { vertical: "middle" };
}

function styleMobilepayCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 13, color: { argb: "FF92400E" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEF3C7" },
  };
  cell.alignment = { vertical: "middle" };
  cell.border = {
    top: { style: "thin", color: { argb: "FFF59E0B" } },
    bottom: { style: "thin", color: { argb: "FFF59E0B" } },
    left: { style: "thin", color: { argb: "FFF59E0B" } },
    right: { style: "thin", color: { argb: "FFF59E0B" } },
  };
}

function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FF0F172A" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };
}

function styleDataCell(cell: ExcelJS.Cell, centered = false) {
  cell.alignment = {
    vertical: "middle",
    horizontal: centered ? "center" : "left",
  };
  cell.border = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };
}

function buildWorkshopSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  workshopTitle: string,
  participants: string[]
) {
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { width: 36 },
    { width: 16 },
    { width: 22 },
  ];

  sheet.mergeCells("A1:C1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = workshopTitle;
  styleTitleCell(titleCell);
  sheet.getRow(1).height = 28;

  sheet.mergeCells("A3:C3");
  const mobilepayCell = sheet.getCell("A3");
  mobilepayCell.value = `Mobilepay: ${MOBILEPAY_NUMBER}`;
  styleMobilepayCell(mobilepayCell);
  sheet.getRow(3).height = 24;

  const headerRow = sheet.getRow(5);
  headerRow.values = ["Navn", "Tjekket ind", "Betalt på Mobilepay"];
  headerRow.height = 22;
  headerRow.eachCell((cell) => styleHeaderCell(cell));

  participants.forEach((name, index) => {
    const rowNumber = 6 + index;
    const row = sheet.getRow(rowNumber);
    row.values = [name, "", ""];
    row.height = 20;
    styleDataCell(row.getCell(1));
    styleDataCell(row.getCell(2), true);
    styleDataCell(row.getCell(3), true);
  });

  sheet.views = [{ state: "frozen", ySplit: 5 }];
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
}

async function main() {
  const workshops = await collectWorkshops();
  if (workshops.size === 0) {
    throw new Error("Ingen workshops fundet i Airtable.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Familiekursus";
  workbook.created = new Date();

  const usedSheetNames = new Set<string>();
  const sorted = Array.from(workshops.entries()).sort(([a], [b]) =>
    a.localeCompare(b, "da")
  );

  for (const [workshopName, participants] of sorted) {
    const sheetName = uniqueSheetName(workshopName, usedSheetNames);
    buildWorkshopSheet(workbook, sheetName, workshopName, participants);
  }

  await workbook.xlsx.writeFile(OUTPUT_PATH);

  console.log(`Excel oprettet: ${OUTPUT_PATH}`);
  console.log(`${sorted.length} workshops, ${sorted.reduce((n, [, p]) => n + p.length, 0)} deltagerlinjer i alt.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
