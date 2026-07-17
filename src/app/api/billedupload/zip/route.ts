import { getBrugerByEmail, getFamilyByEmail } from "@/lib/airtable";
import { blobStoreOptions, isBlobUploadConfigured } from "@/lib/blob-config";
import { listFamiliekursusBilleder } from "@/lib/familiekursus-billeder";
import { get } from "@vercel/blob";
import JSZip from "jszip";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email as string | undefined)?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }

    const bruger = await getBrugerByEmail(email);
    if (!bruger?.isAdmin) {
      return NextResponse.json({ error: "Kun administratorer har adgang" }, { status: 403 });
    }

    if (!isBlobUploadConfigured()) {
      return NextResponse.json({ error: "Billede-upload er ikke konfigureret." }, { status: 503 });
    }

    const { groups } = await listFamiliekursusBilleder();
    if (groups.length === 0) {
      return NextResponse.json({ error: "Ingen billeder at downloade" }, { status: 404 });
    }

    const zip = new JSZip();
    const familieCache = new Map<string, string | null>();

    for (const group of groups) {
      let folderName = familieCache.get(group.email);
      if (folderName === undefined) {
        folderName = (await getFamilyByEmail(group.email)) || group.email;
        familieCache.set(group.email, folderName);
      }
      const safeFolder = (folderName || group.email).replace(/[\\/:*?"<>|]+/g, "-");

      for (const file of group.files) {
        const result = await get(file.pathname, { access: "private", ...blobStoreOptions() });
        if (!result || result.statusCode !== 200 || !result.stream) continue;
        const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
        zip.file(`${safeFolder}/${file.filename}`, buffer);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const dateLabel = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="familiekursus-billeder-${dateLabel}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Billedupload zip fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
