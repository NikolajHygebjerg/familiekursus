import {
  deleteMoedOsPerson,
  getBrugerByEmail,
  getMoedOsAirtableState,
  upsertMoedOsAirtableRecord,
} from "@/lib/airtable";
import {
  MOED_OS_TITLE,
  buildMoedOsPersonViews,
  canAdminEditMoedOsPerson,
  getStaticMoedOsSlugs,
  isMoedOsSuperAdmin,
  isStaticMoedOsSlug,
  resolveMoedOsPersonForUpload,
  slugFromPersonName,
} from "@/lib/moed-os";
import { isBlobUploadConfigured } from "@/lib/blob-config";
import { applyMoedOsBlobImages, getLatestMoedOsBlobPathBySlug } from "@/lib/moed-os-blobs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase() || null;

    const staticSlugs = getStaticMoedOsSlugs();
    const airtableState = await getMoedOsAirtableState(staticSlugs);
    let isAdmin = false;
    let adminNavn: string | null = null;

    if (email) {
      const bruger = await getBrugerByEmail(email);
      isAdmin = bruger?.isAdmin ?? false;
      adminNavn = bruger?.adminNavn ?? null;
    }

    const people = applyMoedOsBlobImages(
      buildMoedOsPersonViews(airtableState, email, adminNavn, isAdmin),
      await getLatestMoedOsBlobPathBySlug()
    );

    return NextResponse.json({
      title: MOED_OS_TITLE,
      people,
      isSuperAdmin: isAdmin && isMoedOsSuperAdmin(email),
      uploadEnabled: isBlobUploadConfigured(),
    });
  } catch (error) {
    console.error("Mød os GET fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    const slugInput = body.slug?.trim().toLowerCase();

    if (!email || !name) {
      return NextResponse.json({ error: "Email og navn mangler" }, { status: 400 });
    }

    if (!isMoedOsSuperAdmin(email)) {
      return NextResponse.json({ error: "Kun super-admin kan tilføje personer" }, { status: 403 });
    }

    const slug = slugInput || slugFromPersonName(name);
    if (!slug || slug.length < 2) {
      return NextResponse.json({ error: "Ugyldigt slug" }, { status: 400 });
    }

    const staticSlugs = getStaticMoedOsSlugs();
    const airtableState = await getMoedOsAirtableState(staticSlugs);

    if (airtableState.customPeople.some((person) => person.slug === slug)) {
      return NextResponse.json({ error: "En person med dette slug findes allerede" }, { status: 409 });
    }

    if (staticSlugs.has(slug) && !airtableState.hiddenSlugs.has(slug)) {
      return NextResponse.json({ error: "En person med dette slug findes allerede" }, { status: 409 });
    }

    await upsertMoedOsAirtableRecord(slug, { name, hidden: false });

    return NextResponse.json({ ok: true, slug });
  } catch (error) {
    console.error("Mød os POST fejl:", error);
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
    const hasTitleField = body.title !== undefined && body.title !== null;

    if (!email || !slug) {
      return NextResponse.json({ error: "Email og slug mangler" }, { status: 400 });
    }

    if (name) {
      if (!isMoedOsSuperAdmin(email)) {
        return NextResponse.json({ error: "Kun super-admin kan ændre navne" }, { status: 403 });
      }
      await upsertMoedOsAirtableRecord(slug, { name, hidden: false });
      return NextResponse.json({ ok: true });
    }

    if (hasTitleField) {
      const bruger = await getBrugerByEmail(email);
      if (!bruger?.isAdmin) {
        return NextResponse.json({ error: "Kun administratorer kan ændre titler" }, { status: 403 });
      }

      const airtableState = await getMoedOsAirtableState(getStaticMoedOsSlugs());
      const person = resolveMoedOsPersonForUpload(slug, airtableState);
      if (!person) {
        return NextResponse.json({ error: "Ukendt person" }, { status: 404 });
      }

      if (!canAdminEditMoedOsPerson(email, bruger.adminNavn, person)) {
        return NextResponse.json(
          { error: "Du har ikke adgang til at opdatere titel for denne person" },
          { status: 403 }
        );
      }

      const title = typeof body.title === "string" ? body.title.trim() : "";
      await upsertMoedOsAirtableRecord(slug, {
        name: person.name,
        title,
        linkedEmail: person.linkedEmail,
        hidden: false,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Navn eller titel mangler" }, { status: 400 });
  } catch (error) {
    console.error("Mød os PATCH fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const slug = body.slug?.trim().toLowerCase();

    if (!email || !slug) {
      return NextResponse.json({ error: "Email og slug mangler" }, { status: 400 });
    }

    if (!isMoedOsSuperAdmin(email)) {
      return NextResponse.json({ error: "Kun super-admin kan slette personer" }, { status: 403 });
    }

    await deleteMoedOsPerson(slug, isStaticMoedOsSlug(slug));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mød os DELETE fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
