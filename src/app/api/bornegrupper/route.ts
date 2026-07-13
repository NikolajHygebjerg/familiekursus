import { getFamilyBornegruppeOverview } from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const email = new URL(request.url).searchParams.get("email")?.trim();
    if (!email) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }

    const groups = await getFamilyBornegruppeOverview(email);
    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Børnegrupper API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
