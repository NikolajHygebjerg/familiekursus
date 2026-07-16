import {
  getAllForhaandstilmeldinger,
  getBrugerByEmail,
} from "@/lib/airtable";
import { buildForhaandstilmeldingExcel } from "@/lib/forhaandstilmelding-excel";
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

    const entries = await getAllForhaandstilmeldinger();
    const excelBuffer = await buildForhaandstilmeldingExcel(entries);
    const dateLabel = new Date().toISOString().slice(0, 10);
    const filename = `forhaandstilmeldinger-${dateLabel}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Forhåndstilmelding export fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
