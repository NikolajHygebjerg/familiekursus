import { put } from "@vercel/blob";
import { getBrugerByEmail, getMoedOsAirtableState, upsertMoedOsAirtableRecord } from "@/lib/airtable";
import { isBlobUploadConfigured, moedOsImageProxyUrl, blobStoreOptions } from "@/lib/blob-config";
import {
  canAdminEditMoedOsPerson,
  getStaticMoedOsSlugs,
  resolveMoedOsPersonForUpload,
} from "@/lib/moed-os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    if (!isBlobUploadConfigured()) {
      return NextResponse.json(
        {
          error:
            "Billede-upload er ikke konfigureret endnu. Forbind Blob under Vercel → Storage.",
        },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const slug = String(formData.get("slug") || "")
      .trim()
      .toLowerCase();
    const file = formData.get("file");

    if (!email || !slug || !(file instanceof File)) {
      return NextResponse.json({ error: "Email, slug og fil mangler" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Kun JPG, PNG, WebP og GIF er tilladt" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Billedet må max være 4,5 MB" }, { status: 400 });
    }

    const bruger = await getBrugerByEmail(email);
    if (!bruger?.isAdmin) {
      return NextResponse.json({ error: "Kun administratorer kan uploade billeder" }, { status: 403 });
    }

    const airtableState = await getMoedOsAirtableState(getStaticMoedOsSlugs());
    const person = resolveMoedOsPersonForUpload(slug, airtableState);
    if (!person) {
      return NextResponse.json({ error: "Ukendt person" }, { status: 404 });
    }

    if (!canAdminEditMoedOsPerson(email, bruger.adminNavn, person)) {
      return NextResponse.json(
        { error: "Du har ikke adgang til at opdatere dette billede" },
        { status: 403 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const pathname = `moed-os/${slug}-${Date.now()}.${ext}`;
    const blob = await put(pathname, file, {
      access: "private",
      ...blobStoreOptions(),
    });

    const imageUrl = `${moedOsImageProxyUrl(blob.pathname)}&v=${Date.now()}`;

    await upsertMoedOsAirtableRecord(slug, {
      name: person.name,
      imageUrl,
      blobPathname: blob.pathname,
      linkedEmail: person.linkedEmail,
      hidden: false,
    });

    return NextResponse.json({ ok: true, imageUrl, pathname: blob.pathname });
  } catch (error) {
    console.error("Mød os upload fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
