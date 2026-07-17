import { emailExistsIn2026, getBrugerByEmail, getFamilyByEmail } from "@/lib/airtable";
import { blobStoreOptions, isBlobUploadConfigured } from "@/lib/blob-config";
import { listFamiliekursusBilleder } from "@/lib/familiekursus-billeder";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return base.slice(0, 80) || "billede.jpg";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const listAll = searchParams.get("list") === "1";

    if (!listAll) {
      return NextResponse.json({ error: "Ugyldig forespørgsel" }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }

    const bruger = await getBrugerByEmail(email);
    if (!bruger?.isAdmin) {
      return NextResponse.json({ error: "Kun administratorer har adgang" }, { status: 403 });
    }

    if (!isBlobUploadConfigured()) {
      return NextResponse.json(
        { error: "Billede-upload er ikke konfigureret endnu." },
        { status: 503 }
      );
    }

    const { groups, totalCount } = await listFamiliekursusBilleder();
    const enrichedGroups = await Promise.all(
      groups.map(async (group) => ({
        ...group,
        familie: (await getFamilyByEmail(group.email)) || null,
      }))
    );

    return NextResponse.json({
      groups: enrichedGroups,
      summary: {
        families: groups.length,
        images: totalCount,
      },
    });
  } catch (error) {
    console.error("Billedupload GET fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}

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
    const uploaderEmail = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const targetEmailRaw = String(formData.get("targetEmail") || "").trim().toLowerCase();
    const file = formData.get("file");

    if (!uploaderEmail || !(file instanceof File)) {
      return NextResponse.json({ error: "Email og fil mangler" }, { status: 400 });
    }

    const bruger = await getBrugerByEmail(uploaderEmail);
    const isAdmin = Boolean(bruger?.isAdmin);
    const storageEmail = targetEmailRaw || uploaderEmail;

    if (!isAdmin && !(await emailExistsIn2026(uploaderEmail))) {
      return NextResponse.json(
        { error: "Kun tilmeldte familier kan uploade billeder" },
        { status: 403 }
      );
    }

    if (isAdmin && targetEmailRaw && !(await emailExistsIn2026(targetEmailRaw))) {
      return NextResponse.json(
        { error: "Familie-email findes ikke blandt tilmeldte" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Kun JPG, PNG, WebP og GIF er tilladt" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Billedet må max være 4,5 MB. Prøv et mindre billede." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeEmail = storageEmail.replace(/[^a-z0-9@._-]/g, "");
    const pathname = `familiekursus-billeder/${safeEmail}/${Date.now()}-${sanitizeFilename(file.name)}`;
    const blob = await put(pathname, file, {
      access: "private",
      contentType: file.type || `image/${ext}`,
      ...blobStoreOptions(),
    });

    return NextResponse.json({ ok: true, pathname: blob.pathname });
  } catch (error) {
    console.error("Billedupload fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
