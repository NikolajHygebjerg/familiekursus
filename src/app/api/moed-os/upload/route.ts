import { put } from "@vercel/blob";
import { getBrugerByEmail, upsertMoedOsAirtableRecord } from "@/lib/airtable";
import {
  MOED_OS_PEOPLE,
  buildMoedOsPersonViews,
  canAdminEditMoedOsPerson,
  slugFromMoedOsImage,
} from "@/lib/moed-os";
import { getMoedOsAirtableOverrides } from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error:
            "Billede-upload er ikke konfigureret endnu. Tilføj BLOB_READ_WRITE_TOKEN i Vercel.",
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
      return NextResponse.json({ error: "Billedet må max være 5 MB" }, { status: 400 });
    }

    const bruger = await getBrugerByEmail(email);
    if (!bruger?.isAdmin) {
      return NextResponse.json({ error: "Kun administratorer kan uploade billeder" }, { status: 403 });
    }

    const staticPerson = MOED_OS_PEOPLE.find(
      (person) => slugFromMoedOsImage(person.image) === slug
    );
    if (!staticPerson) {
      return NextResponse.json({ error: "Ukendt person" }, { status: 404 });
    }

    const overrides = await getMoedOsAirtableOverrides();
    const override = overrides.get(slug);
    const personForAuth = {
      name: override?.name ?? staticPerson.name,
      linkedEmail: override?.linkedEmail ?? null,
    };

    if (!canAdminEditMoedOsPerson(email, bruger.adminNavn, personForAuth)) {
      return NextResponse.json(
        { error: "Du har ikke adgang til at opdatere dette billede" },
        { status: 403 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const blob = await put(`moed-os/${slug}-${Date.now()}.${ext}`, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    await upsertMoedOsAirtableRecord(slug, {
      name: personForAuth.name,
      imageUrl: blob.url,
      linkedEmail: personForAuth.linkedEmail,
    });

    return NextResponse.json({ ok: true, imageUrl: blob.url });
  } catch (error) {
    console.error("Mød os upload fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
