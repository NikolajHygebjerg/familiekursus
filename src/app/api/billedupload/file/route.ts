import { canAccessBilledupload } from "@/lib/billedupload-access";
import { blobStoreOptions } from "@/lib/blob-config";
import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BILLEUPLOAD_PREFIX = "familiekursus-billeder/";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pathname = searchParams.get("pathname")?.trim();
    const email = searchParams.get("email")?.trim().toLowerCase();
    const download = searchParams.get("download") === "1";

    if (!pathname || pathname.includes("..") || !email) {
      return NextResponse.json({ error: "Ugyldig forespørgsel" }, { status: 400 });
    }

    if (!pathname.startsWith(BILLEUPLOAD_PREFIX)) {
      return NextResponse.json({ error: "Adgang nægtet" }, { status: 403 });
    }

    if (!(await canAccessBilledupload(email))) {
      return NextResponse.json({ error: "Adgang nægtet" }, { status: 403 });
    }

    const result = await get(pathname, { access: "private", ...blobStoreOptions() });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse("Ikke fundet", { status: 404 });
    }

    const filename = pathname.split("/").pop() || "billede.jpg";
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
    return new NextResponse("Kunne ikke hente billede", { status: 500 });
  }
}
