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
const COLUMN_GAP = 1;

const WORKSHOP_KEYS = [
  { key: "workshop1" as const, label: "Workshop 1" },
  { key: "workshop2" as const, label: "Workshop 2" },
  { key: "workshop3" as const, label: "Workshop 3" },
  { key: "workshop4" as const, label: "Workshop 4" },
  { key: "voksen" as const, label: "Workshop Forældre" },
];

interface WorkshopColumn {
  name: string;
  firstNames: string[];
}

interface SlotGroup {
  label: string;
  workshops: WorkshopColumn[];
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return trimmed;
  return trimmed.split(/\s+/)[0];
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

function styleSlotHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 12, color: { argb: "FF1E293B" } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };
  cell.border = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };
}

function styleWorkshopHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };
  cell.border = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };
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

async function collectSlotGroups(): Promise<SlotGroup[]> {
  const { getWorkshopCounts } = await import("../src/lib/airtable");
  const groups: SlotGroup[] = [];

  for (const { key, label } of WORKSHOP_KEYS) {
    const counts = await getWorkshopCounts(key, true);
    const workshops: WorkshopColumn[] = [];

    for (const { name, participants } of counts) {
      if (!name.trim()) continue;
      const firstNames = Array.from(
        new Set((participants ?? []).map(firstName).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "da"));
      workshops.push({ name, firstNames });
    }

    workshops.sort((a, b) => a.name.localeCompare(b.name, "da"));
    if (workshops.length > 0) {
      groups.push({ label, workshops });
    }
  }

  return groups;
}

function buildCombinedSheet(workbook: ExcelJS.Workbook, groups: SlotGroup[]) {
  const sheet = workbook.addWorksheet("Workshops");
  let col = 1;
  let maxDataRows = 0;
  let workshopCount = 0;

  for (const group of groups) {
    const workshopCountInGroup = group.workshops.length;
    if (workshopCountInGroup === 0) continue;

    const startCol = col;
    const endCol = col + workshopCountInGroup - 1;

    sheet.mergeCells(1, startCol, 1, endCol);
    const slotCell = sheet.getCell(1, startCol);
    slotCell.value = group.label;
    styleSlotHeaderCell(slotCell);
    sheet.getRow(1).height = 24;

    group.workshops.forEach((workshop, index) => {
      const workshopCol = startCol + index;
      sheet.getColumn(workshopCol).width = 14;

      const headerCell = sheet.getCell(2, workshopCol);
      headerCell.value = workshop.name;
      styleWorkshopHeaderCell(headerCell);

      workshop.firstNames.forEach((name, rowIndex) => {
        const cell = sheet.getCell(3 + rowIndex, workshopCol);
        cell.value = name;
        styleNameCell(cell);
      });

      maxDataRows = Math.max(maxDataRows, workshop.firstNames.length);
      workshopCount += 1;
    });

    col = endCol + 1 + COLUMN_GAP;
  }

  sheet.getRow(2).height = 22;
  for (let row = 3; row < 3 + maxDataRows; row += 1) {
    sheet.getRow(row).height = 18;
  }

  sheet.views = [{ state: "frozen", ySplit: 2, activeCell: "A3" }];
  a3LandscapePageSetup(sheet);

  return { workshopCount, totalNames: groups.reduce(
    (sum, group) => sum + group.workshops.reduce((groupSum, workshop) => groupSum + workshop.firstNames.length, 0),
    0
  ) };
}

async function main() {
  const groups = await collectSlotGroups();
  if (groups.length === 0) {
    throw new Error("Ingen workshops fundet i Airtable.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Familiekursus";
  workbook.created = new Date();

  const { workshopCount, totalNames } = buildCombinedSheet(workbook, groups);

  await workbook.xlsx.writeFile(OUTPUT_PATH);

  console.log(`Excel oprettet: ${OUTPUT_PATH}`);
  console.log(`${workshopCount} workshops på ét ark, ${totalNames} fornavne i alt (uden aftengrupper).`);
  console.log("Print: vælg A3, vandret (landskab).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
