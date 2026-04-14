import { getProgram } from "@/lib/airtable";
import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  try {
    const program = await getProgram();
    return NextResponse.json(program);
  } catch (error) {
    console.error("Program API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
