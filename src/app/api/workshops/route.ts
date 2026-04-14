import { getWorkshopCounts } from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workshop = searchParams.get("workshop");

    const validWorkshops = ["workshop1", "workshop2", "workshop3", "workshop4", "voksen"];
    if (!workshop || !validWorkshops.includes(workshop)) {
      return NextResponse.json(
        { error: "Ugyldig workshop. Brug: workshop1, workshop2, workshop3, workshop4 eller voksen" },
        { status: 400 }
      );
    }

    const withParticipants = searchParams.get("withParticipants") === "true";
    const counts = await getWorkshopCounts(
      workshop as "workshop1" | "workshop2" | "workshop3" | "workshop4" | "voksen",
      withParticipants
    );
    return NextResponse.json(counts);
  } catch (error) {
    console.error("Workshop API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
