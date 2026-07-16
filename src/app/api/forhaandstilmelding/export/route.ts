import {
  getAllForhaandstilmeldinger,
  getBrugerByEmail,
} from "@/lib/airtable";
import { sendEmailWithAttachment } from "@/lib/email";
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

    await sendEmailWithAttachment({
      to: email,
      subject: `Forhåndstilmeldinger – Familiekursus ${dateLabel}`,
      text: `Vedhæftet er oversigt over ${entries.length} forhåndstilmeldinger (${entries.reduce((s, e) => s + e.antalVoksne, 0)} voksne og ${entries.reduce((s, e) => s + e.antalBorn, 0)} børn).`,
      attachment: {
        filename: `forhaandstilmeldinger-${dateLabel}.xlsx`,
        content: excelBuffer,
      },
    });

    return NextResponse.json({ ok: true, count: entries.length });
  } catch (error) {
    console.error("Forhåndstilmelding export fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
