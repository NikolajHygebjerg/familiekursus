import { getAdminAssignedWorkshops, getBrugerByEmail } from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }

    const bruger = await getBrugerByEmail(email);
    if (!bruger?.isAdmin) {
      return NextResponse.json({ error: "Kun administratorer har adgang" }, { status: 403 });
    }

    if (!bruger.adminNavn?.trim()) {
      return NextResponse.json({ workshops: [], adminNavn: null });
    }

    const workshops = await getAdminAssignedWorkshops(bruger.adminNavn);
    return NextResponse.json({ workshops, adminNavn: bruger.adminNavn });
  } catch (error) {
    console.error("My workshops API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
