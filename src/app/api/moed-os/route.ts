import { getBrugerByEmail, getMoedOsAirtableOverrides, upsertMoedOsAirtableRecord } from "@/lib/airtable";
import {
  MOED_OS_PEOPLE,
  MOED_OS_TITLE,
  buildMoedOsPersonViews,
  isMoedOsSuperAdmin,
} from "@/lib/moed-os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase() || null;

    const overrides = await getMoedOsAirtableOverrides();
    let isAdmin = false;
    let adminNavn: string | null = null;

    if (email) {
      const bruger = await getBrugerByEmail(email);
      isAdmin = bruger?.isAdmin ?? false;
      adminNavn = bruger?.adminNavn ?? null;
    }

    const people = buildMoedOsPersonViews(
      MOED_OS_PEOPLE,
      overrides,
      email,
      adminNavn,
      isAdmin
    );

    return NextResponse.json({
      title: MOED_OS_TITLE,
      people,
      isSuperAdmin: isAdmin && isMoedOsSuperAdmin(email),
      uploadEnabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    });
  } catch (error) {
    console.error("Mød os GET fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const slug = body.slug?.trim().toLowerCase();
    const name = body.name?.trim();

    if (!email || !slug || !name) {
      return NextResponse.json({ error: "Email, slug og navn mangler" }, { status: 400 });
    }

    if (!isMoedOsSuperAdmin(email)) {
      return NextResponse.json({ error: "Kun super-admin kan ændre navne" }, { status: 403 });
    }

    await upsertMoedOsAirtableRecord(slug, { name });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mød os PATCH fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
