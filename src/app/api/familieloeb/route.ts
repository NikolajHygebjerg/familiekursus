import {
  getAllFamilieloebHolds,
  getFamilieloebInfoByEmail,
  moveFamilyBetweenFamilieloebHolds,
} from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all");
    if (all === "1") {
      const holds = await getAllFamilieloebHolds();
      return NextResponse.json({ holds });
    }

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, familyName, fromHold, toHold } = body as {
      action?: string;
      familyName?: string;
      fromHold?: string;
      toHold?: string;
    };

    if (action !== "moveFamily") {
      return NextResponse.json({ error: "Ukendt handling" }, { status: 400 });
    }
    if (!familyName?.trim() || !fromHold?.trim() || !toHold?.trim()) {
      return NextResponse.json({ error: "Mangler familyName/fromHold/toHold" }, { status: 400 });
    }

    const holds = await moveFamilyBetweenFamilieloebHolds(
      familyName.trim(),
      fromHold.trim(),
      toHold.trim()
    );
    return NextResponse.json({ ok: true, holds });
  } catch (error) {
    console.error("Familieløbet POST API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
