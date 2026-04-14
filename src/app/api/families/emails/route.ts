import { getEmailsFrom2026 } from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const emails = await getEmailsFrom2026();
    return NextResponse.json(emails);
  } catch (error) {
    console.error("Families emails API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
