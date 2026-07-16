import {
  getProgram,
  getWorkshopLocationByName,
  getAldersgrupperDefinitions,
  buildAldersgruppeProgramLines,
} from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [program, workshopLocations, aldersgruppeLinjer] = await Promise.all([
      getProgram(),
      getWorkshopLocationByName(),
      getAldersgrupperDefinitions().then(buildAldersgruppeProgramLines),
    ]);
    return NextResponse.json({ program, workshopLocations, aldersgruppeLinjer });
  } catch (error) {
    console.error("Program API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
