import { getFamilyMembersByEmail } from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }
    const members = await getFamilyMembersByEmail(email.trim());
    return NextResponse.json(members);
  } catch (error) {
    console.error("Families by email API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
