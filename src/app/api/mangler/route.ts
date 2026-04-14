import { getMissingWorkshopSelections } from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const missing = await getMissingWorkshopSelections();
    return NextResponse.json(missing);
  } catch (error) {
    console.error("Mangler API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
