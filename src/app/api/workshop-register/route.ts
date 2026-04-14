import {
  createAirtableRecord,
  getYearTableId,
  WORKSHOP_FIELDS,
} from "@/lib/airtable";
import { NextResponse } from "next/server";

const NAVN_FIELDS = ["Navn", "navn", "Name", "name"];
const EMAIL_FIELDS = ["Email", "email", "A Email"];
const FAMILIE_FIELDS = ["Familie", "familie", "Family", "family"];
const BARN_VOKSEN_FIELDS = ["Barn/voksen", "Barn/Voksen", "barn_voksen"];

function getYear(): number {
  return new Date().getFullYear();
}

function fieldName(key: keyof typeof WORKSHOP_FIELDS): string {
  return WORKSHOP_FIELDS[key][0];
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      navn,
      type,
      workshop1,
      workshop2,
      workshop3,
      workshop4,
      voksen,
      familie,
    } = body as {
      email: string;
      navn: string;
      type?: string;
      workshop1?: string;
      workshop2?: string;
      workshop3?: string;
      workshop4?: string;
      voksen?: string;
      familie?: string;
    };

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }
    if (!navn?.trim()) {
      return NextResponse.json({ error: "Navn mangler" }, { status: 400 });
    }

    const year = getYear();
    const tableId = getYearTableId(year);

    const fields: Record<string, string> = {
      [EMAIL_FIELDS[0]]: email.trim(),
      [NAVN_FIELDS[0]]: navn.trim(),
    };
    if (type?.trim()) fields[BARN_VOKSEN_FIELDS[0]] = type.trim();
    if (familie?.trim()) fields[FAMILIE_FIELDS[0]] = familie.trim();
    if (workshop1?.trim()) fields[fieldName("workshop1")] = workshop1.trim();
    if (workshop2?.trim()) fields[fieldName("workshop2")] = workshop2.trim();
    if (workshop3?.trim()) fields[fieldName("workshop3")] = workshop3.trim();
    if (workshop4?.trim()) fields[fieldName("workshop4")] = workshop4.trim();
    if (voksen?.trim()) fields[fieldName("voksen")] = voksen.trim();

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
