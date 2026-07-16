import ExcelJS from "exceljs";
import type { Forhaandstilmelding } from "@/lib/airtable";

export async function buildForhaandstilmeldingExcel(
  entries: Forhaandstilmelding[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Forhåndstilmeldinger");

  sheet.columns = [
    { header: "Navn", key: "navn", width: 28 },
    { header: "Email", key: "email", width: 32 },
    { header: "Antal voksne", key: "antalVoksne", width: 14 },
    { header: "Antal børn", key: "antalBorn", width: 14 },
    { header: "I alt", key: "total", width: 10 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEF3C7" },
  };

  for (const entry of entries) {
    sheet.addRow({
      navn: entry.navn,
      email: entry.email,
      antalVoksne: entry.antalVoksne,
      antalBorn: entry.antalBorn,
      total: entry.antalVoksne + entry.antalBorn,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
