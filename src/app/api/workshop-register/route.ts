import {
  createAirtableRecord,
  getYearTableId,
} from "@/lib/airtable";
import { getKursusYear } from "@/lib/kursus-year";
import { NextResponse } from "next/server";

const NAVN_FIELDS = ["Navn", "navn", "Name", "name"];
const EMAIL_FIELDS = ["Email", "email", "A Email"];
const BRUGERNAVN_FIELDS = ["Brugernavn", "brugernavn", "Login", "login"];
const FAMILIE_FIELDS = ["Familie", "familie", "Family", "family"];
const ALDER_FIELDS = ["Alder", "A Alder", "#Alder", "alder", "Age", "age"];

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, navn, alder } = body as {
      email: string;
      navn: string;
      alder?: string | number;
    };

    if (!email?.trim()) {
      return NextResponse.json({ error: "Brugernavn mangler" }, { status: 400 });
    }
    const fornavn = navn?.trim();
    if (!fornavn) {
      return NextResponse.json({ error: "Fornavn mangler" }, { status: 400 });
    }

    const alderRaw = alder === undefined || alder === null ? "" : String(alder).trim();
    if (!alderRaw) {
      return NextResponse.json({ error: "Alder mangler" }, { status: 400 });
    }
    const alderNum = parseInt(alderRaw.replace(",", "."), 10);
    if (!Number.isFinite(alderNum) || alderNum < 0 || alderNum > 120) {
      return NextResponse.json({ error: "Angiv en gyldig alder" }, { status: 400 });
    }

    const year = getKursusYear();
    const tableId = getYearTableId(year);
    const login = email.trim();

    const fields: Record<string, string | number> = {
      [BRUGERNAVN_FIELDS[0]]: login,
      [EMAIL_FIELDS[0]]: login,
      [FAMILIE_FIELDS[0]]: login,
      [NAVN_FIELDS[0]]: fornavn,
      [ALDER_FIELDS[0]]: alderNum,
    };

    await createAirtableRecord(tableId, fields);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Workshop register API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
