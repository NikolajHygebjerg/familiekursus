import { getProgram, getWorkshopLocationByName } from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [program, workshopLocations] = await Promise.all([
      getProgram(),
      getWorkshopLocationByName(),
    ]);
    return NextResponse.json({ program, workshopLocations });
  } catch (error) {
    console.error("Program API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
