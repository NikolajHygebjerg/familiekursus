import { canAccessBilledupload } from "@/lib/billedupload-access";
import { fetchFamiliekursusBlob, isFamiliekursusBlobUrl } from "@/lib/familiekursus-blob-fetch";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BILLEUPLOAD_PREFIX = "familiekursus-billeder/";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const blobUrl = searchParams.get("url")?.trim();
    const pathname = searchParams.get("pathname")?.trim();
    const email = searchParams.get("email")?.trim().toLowerCase();
    const download = searchParams.get("download") === "1";

    if (!email || (!blobUrl && !pathname)) {
      return NextResponse.json({ error: "Ugyldig forespørgsel" }, { status: 400 });
    }

    if (blobUrl && !isFamiliekursusBlobUrl(blobUrl)) {
      return NextResponse.json({ error: "Adgang nægtet" }, { status: 403 });
    }

    if (pathname && (pathname.includes("..") || !pathname.startsWith(BILLEUPLOAD_PREFIX))) {
      return NextResponse.json({ error: "Adgang nægtet" }, { status: 403 });
    }

    if (!(await canAccessBilledupload(email))) {
      return NextResponse.json({ error: "Adgang nægtet" }, { status: 403 });
    }

    const result = await fetchFamiliekursusBlob(blobUrl || pathname!, pathname || undefined);
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse("Ikke fundet", { status: 404 });
    }

    const filename =
      (blobUrl || pathname!).split("/").pop()?.split("?")[0] || "billede.jpg";
    const headers: Record<string, string> = {
      "Content-Type": result.blob.contentType || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${filename.replace(/"/g, "")}"`;
    }

    return new NextResponse(result.stream, { headers });
  } catch (error) {
    console.error("Billedupload fil fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunne ikke hente billede" },
      { status: 500 }
    );
  }
}
