import { getCastSongById } from "@/lib/cast/songs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Sang-id mangler" }, { status: 400 });
  }

  const song = getCastSongById(id);
  if (!song) {
    return NextResponse.json({ error: "Sang ikke fundet" }, { status: 404 });
  }

  return NextResponse.json(song);
}
