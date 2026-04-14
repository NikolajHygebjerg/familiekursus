import {
  getWorkshopoversigtParticipants,
  addToYearTableActivity,
  getAftengrupperOptions,
  getNamesFromYearTableForEmail,
  getYearTableFieldNames,
} from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FieldKey = "aftengrupper" | "gyserløb" | "sheltertur";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const field = searchParams.get("field") as FieldKey | null;
    const options = searchParams.get("options");
    const names = searchParams.get("names");
    const debug = searchParams.get("debug");
    const q = searchParams.get("q") ?? "";
    const email = searchParams.get("email") ?? "";
    if (debug === "fields") {
      const fieldNames = await getYearTableFieldNames();
      return NextResponse.json({ fields: fieldNames });
    }
    if (options === "aftengrupper") {
      const opts = await getAftengrupperOptions();
      return NextResponse.json(opts);
    }
    if (names === "1" && email) {
      const nameList = await getNamesFromYearTableForEmail(email, q || undefined);
      return NextResponse.json(nameList);
    }
    if (!field || !["aftengrupper", "gyserløb", "sheltertur"].includes(field)) {
      return NextResponse.json({ error: "Ugyldigt felt" }, { status: 400 });
    }
    const participants = await getWorkshopoversigtParticipants(field);
    return NextResponse.json(participants);
  } catch (error) {
    console.error("Workshopoversigt GET fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { field, navn, email, alder, valgtOption, type } = body as {
      field: FieldKey;
      navn: string;
      email?: string;
      alder?: string;
      valgtOption?: string;
      type?: string;
    };
    if (!field || !["aftengrupper", "gyserløb", "sheltertur"].includes(field)) {
      return NextResponse.json({ error: "Ugyldigt felt" }, { status: 400 });
    }
    if (!navn?.trim()) {
      return NextResponse.json({ error: "Navn mangler" }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }
    const opts: { alder?: string; valgtOption?: string; type?: string } = {};
    if (field === "aftengrupper" && valgtOption) opts.valgtOption = valgtOption.trim();
    if ((field === "gyserløb" || field === "sheltertur") && alder) opts.alder = alder.trim();
    if (type?.trim()) opts.type = type.trim();
    await addToYearTableActivity(field, navn.trim(), email.trim(), opts);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Workshopoversigt POST fejl:", error);
    const message = error instanceof Error ? error.message : "Ukendt fejl";
    const status = message.includes("UNKNOWN_FIELD") ? 422 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
