import {
  getWorkshopoversigtParticipants,
  addToYearTableActivity,
  getAftengrupperOptionsDetailed,
  getNamesFromYearTableForEmail,
  getYearTableFieldNames,
  type ActivityFieldKey,
} from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID_FIELDS: ActivityFieldKey[] = [
  "aftengrupper",
  "gyserløb",
  "sheltertur",
  "sheltertur_med_overnatning",
];

function isValidField(field: string): field is ActivityFieldKey {
  return VALID_FIELDS.includes(field as ActivityFieldKey);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const field = searchParams.get("field");
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
      const opts = await getAftengrupperOptionsDetailed();
      return NextResponse.json(opts);
    }
    if (names === "1" && email) {
      const nameList = await getNamesFromYearTableForEmail(email, q || undefined);
      return NextResponse.json(nameList);
    }
    if (!field || !isValidField(field)) {
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
      field: ActivityFieldKey;
      navn: string;
      email?: string;
      alder?: string;
      valgtOption?: string;
      type?: string;
    };
    if (!field || !isValidField(field)) {
      return NextResponse.json({ error: "Ugyldigt felt" }, { status: 400 });
    }
    if (!navn?.trim()) {
      return NextResponse.json({ error: "Navn mangler" }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }
    const opts: { alder?: string; valgtOption?: string; type?: string } = {};
    if (field === "aftengrupper" && valgtOption) {
      const selected = valgtOption.trim();
      const allOptions = await getAftengrupperOptionsDetailed();
      const matched = allOptions.find((o) => o.name === selected);
      if (!matched) {
        return NextResponse.json({ error: "Ugyldig aftengruppe" }, { status: 400 });
      }
      if (matched.soldOut) {
        return NextResponse.json({ error: `${selected} er udsolgt` }, { status: 409 });
      }
      opts.valgtOption = selected;
    }
    if (
      (field === "gyserløb" ||
        field === "sheltertur" ||
        field === "sheltertur_med_overnatning") &&
      alder
    ) {
      opts.alder = alder.trim();
    }
    if (field === "sheltertur_med_overnatning" && type?.trim() === "Barn") {
      const alderNum = parseInt((alder ?? "").trim(), 10);
      if (isNaN(alderNum) || alderNum < 11) {
        return NextResponse.json(
          { error: "Man skal være mindst 11 år for at overnatte på sheltertur" },
          { status: 400 }
        );
      }
    }
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
