import { getFamilieloebInfoByEmail } from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }

    const info = await getFamilieloebInfoByEmail(email.trim());
    if (!info) {
      return NextResponse.json({ info: null });
    }

    return NextResponse.json({
      holdnavn: info.holdnavn,
      membersText: info.membersText,
      message: `På familieløbet skal du på ${info.holdnavn} sammen med disse skønne mennesker:`,
    });
  } catch (error) {
    console.error("Familieløbet API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
