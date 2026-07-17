import { emailExistsIn2026 } from "@/lib/airtable";
import { blobStoreOptions, isBlobUploadConfigured } from "@/lib/blob-config";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return base.slice(0, 80) || "billede.jpg";
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
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const file = formData.get("file");

    if (!email || !(file instanceof File)) {
      return NextResponse.json({ error: "Email og fil mangler" }, { status: 400 });
    }

    if (!(await emailExistsIn2026(email))) {
      return NextResponse.json(
        { error: "Kun tilmeldte familier kan uploade billeder" },
        { status: 403 }
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
    const safeEmail = email.replace(/[^a-z0-9@._-]/g, "");
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
