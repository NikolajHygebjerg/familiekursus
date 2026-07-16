import {
  getAllForhaandstilmeldinger,
  getBrugerByEmail,
  getFamilyByEmail,
  getForhaandstilmeldingByEmail,
  upsertForhaandstilmelding,
} from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const listAll = searchParams.get("list") === "1";

    if (!email) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }

    if (listAll) {
      const bruger = await getBrugerByEmail(email);
      if (!bruger?.isAdmin) {
        return NextResponse.json({ error: "Kun administratorer har adgang" }, { status: 403 });
      }
      const entries = await getAllForhaandstilmeldinger();
      const totalVoksne = entries.reduce((sum, e) => sum + e.antalVoksne, 0);
      const totalBorn = entries.reduce((sum, e) => sum + e.antalBorn, 0);
      return NextResponse.json({
        entries,
        summary: {
          families: entries.length,
          voksne: totalVoksne,
          born: totalBorn,
          total: totalVoksne + totalBorn,
        },
      });
    }

    const entry = await getForhaandstilmeldingByEmail(email);
    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Forhåndstilmelding GET fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const antalVoksneRaw = body.antalVoksne;
    const antalBornRaw = body.antalBorn;

    if (!email) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }

    const antalVoksne = Number(antalVoksneRaw);
    const antalBorn = Number(antalBornRaw);

    if (!Number.isInteger(antalVoksne) || antalVoksne < 0) {
      return NextResponse.json({ error: "Ugyldigt antal voksne" }, { status: 400 });
    }
    if (!Number.isInteger(antalBorn) || antalBorn < 0) {
      return NextResponse.json({ error: "Ugyldigt antal børn" }, { status: 400 });
    }
    if (antalVoksne + antalBorn < 1) {
      return NextResponse.json(
        { error: "Angiv mindst én voksen eller ét barn" },
        { status: 400 }
      );
    }

    const familie = (await getFamilyByEmail(email)) || email;
    const entry = await upsertForhaandstilmelding(email, familie, antalVoksne, antalBorn);
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    console.error("Forhåndstilmelding POST fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
