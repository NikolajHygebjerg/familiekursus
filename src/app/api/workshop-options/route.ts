import { getWorkshopOptions } from "@/lib/airtable";
import { getAllWorkshopOptionsDetailed } from "@/lib/workshop-capacity";
import { getKursusYear } from "@/lib/kursus-year";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(getKursusYear()), 10);
    const detailed = searchParams.get("detailed") === "1";

    if (detailed) {
      const options = await getAllWorkshopOptionsDetailed();
      return NextResponse.json({ year, detailed: options });
    }

    const options = await getWorkshopOptions(year);
    return NextResponse.json(options);
  } catch (error) {
    console.error("Workshop options API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
