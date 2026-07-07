import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pathname = searchParams.get("pathname")?.trim();
    if (!pathname || pathname.includes("..")) {
      return NextResponse.json({ error: "Ugyldig sti" }, { status: 400 });
    }

    if (!pathname.startsWith("moed-os/")) {
      return NextResponse.json({ error: "Adgang nægtet" }, { status: 403 });
    }

    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse("Ikke fundet", { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Mød os billede fejl:", error);
    return new NextResponse("Kunne ikke hente billede", { status: 500 });
  }
}
