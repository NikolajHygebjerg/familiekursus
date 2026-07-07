import {
  getAldersgrupperDefinitions,
  buildFamilyAldersgruppeBlocks,
  formatAldersgruppeBeskrivelse,
  getFamilyMembersByEmail,
} from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim();

    const groups = await getAldersgrupperDefinitions();

    if (!email) {
      return NextResponse.json({ groups });
    }

    const members = await getFamilyMembersByEmail(email);
    const blocks = buildFamilyAldersgruppeBlocks(members, groups);

    return NextResponse.json({
      groups,
      blocks,
      beskrivelse: formatAldersgruppeBeskrivelse(blocks),
    });
  } catch (error) {
    console.error("Aldersgrupper API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
