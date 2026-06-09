import {
  getFamilyByEmail,
  getBrugerByEmail,
  emailExistsIn2026,
  hasWorkshopRegistration,
  createAirtableRecord,
  updateAirtableRecord,
} from "@/lib/airtable";
import { NextResponse } from "next/server";

const TABLE_BRUGERE = "Brugere";
const BRUGERE_EMAIL_FIELDS = ["Email", "email", "A Email"];
const BRUGERE_KODE_FIELDS = ["Kode", "A Kode", "kode", "Code", "code"];
const BRUGERE_STATUS_FIELD = "Brugerstatus";
const DEFAULT_CODE = "1234";

function getYear(): number {
  return new Date().getFullYear();
}

export const dynamic = "force-dynamic";

async function buildAuthResponse(email: string, isAdmin: boolean) {
  const existsIn2026 = await emailExistsIn2026(email);
  const familyName = isAdmin ? null : existsIn2026 ? await getFamilyByEmail(email) : null;
  const needsReg = isAdmin
    ? false
    : existsIn2026
      ? !(await hasWorkshopRegistration(email, getYear()))
      : true;

  return {
    ok: true,
    email,
    familyName: isAdmin ? "Kursusleder" : familyName,
    isAdmin,
    needsWorkshopRegistration: needsReg,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email: rawEmail, code } = body as {
      action: "login" | "check" | "create" | "setCode" | "resetCode";
      email?: string;
      code?: string;
    };

    const email = (rawEmail as string)?.trim()?.toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }

    if (action === "check") {
      const existsIn2026 = await emailExistsIn2026(email);
      const bruger = await getBrugerByEmail(email);
      const brugerCode = bruger?.code ?? null;
      const brugerExists = !!bruger?.recordId;
      const familyName = existsIn2026 ? await getFamilyByEmail(email) : null;
      const needsReg = existsIn2026
        ? !(await hasWorkshopRegistration(email, getYear()))
        : true;

      if (brugerExists && brugerCode) {
        return NextResponse.json({
          existsIn2026,
          hasBruger: true,
          defaultCode: false,
          familyName,
          needsWorkshopRegistration: needsReg,
        });
      }
      if (brugerExists && !brugerCode) {
        return NextResponse.json({
          existsIn2026,
          hasBruger: false,
          defaultCode: true,
          familyName,
          needsWorkshopRegistration: needsReg,
        });
      }
      if (existsIn2026) {
        return NextResponse.json({
          existsIn2026,
          hasBruger: false,
          defaultCode: true,
          familyName,
          needsWorkshopRegistration: needsReg,
        });
      }
      return NextResponse.json({
        existsIn2026,
        hasBruger: false,
        defaultCode: false,
        familyName,
        needsWorkshopRegistration: true,
      });
    }

    if (action === "create") {
      if (!code || code.length < 4) {
        return NextResponse.json({ error: "Vælg en kode på mindst 4 tegn" }, { status: 400 });
      }
      const existingBruger = await getBrugerByEmail(email);
      if (existingBruger?.recordId) {
        return NextResponse.json(
          { error: "Du har allerede en bruger med denne email. Log ind med din kode eller brug 'Glemt kode?'" },
          { status: 409 }
        );
      }
      try {
        await createAirtableRecord(TABLE_BRUGERE, {
          [BRUGERE_EMAIL_FIELDS[0]]: email,
          [BRUGERE_KODE_FIELDS[0]]: code,
          [BRUGERE_STATUS_FIELD]: "Bruger",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Kunne ikke oprette bruger";
        if (msg.includes("duplicate") || msg.includes("already")) {
          return NextResponse.json({ error: "Denne email er allerede oprettet" }, { status: 409 });
        }
        throw e;
      }
      return NextResponse.json(await buildAuthResponse(email, false));
    }

    if (action === "resetCode") {
      if (!code || code.length < 4) {
        return NextResponse.json({ error: "Vælg en ny kode på mindst 4 tegn" }, { status: 400 });
      }
      const bruger = await getBrugerByEmail(email);
      if (!bruger?.recordId) {
        return NextResponse.json({ error: "Ingen bruger fundet med denne email" }, { status: 404 });
      }
      await updateAirtableRecord(TABLE_BRUGERE, bruger.recordId, {
        [BRUGERE_KODE_FIELDS[0]]: code,
      });
      return NextResponse.json(await buildAuthResponse(email, bruger.isAdmin));
    }

    if (action === "setCode") {
      if (!code || code.length < 4) {
        return NextResponse.json({ error: "Vælg en kode på mindst 4 tegn" }, { status: 400 });
      }
      const bruger = await getBrugerByEmail(email);
      if (bruger?.code) {
        return NextResponse.json({ error: "Du har allerede en kode. Log ind med den." }, { status: 400 });
      }
      if (bruger?.recordId) {
        await updateAirtableRecord(TABLE_BRUGERE, bruger.recordId, {
          [BRUGERE_KODE_FIELDS[0]]: code,
        });
      } else {
        const existsIn2026 = await emailExistsIn2026(email);
        if (!existsIn2026) {
          return NextResponse.json({ error: "Email findes ikke i systemet" }, { status: 404 });
        }
        await createAirtableRecord(TABLE_BRUGERE, {
          [BRUGERE_EMAIL_FIELDS[0]]: email,
          [BRUGERE_KODE_FIELDS[0]]: code,
          [BRUGERE_STATUS_FIELD]: "Bruger",
        });
      }
      const updated = await getBrugerByEmail(email);
      return NextResponse.json(await buildAuthResponse(email, updated?.isAdmin ?? false));
    }

    if (action === "login") {
      const bruger = await getBrugerByEmail(email);
      const existsIn2026 = await emailExistsIn2026(email);
      const expectedCode = bruger?.code ?? (existsIn2026 ? DEFAULT_CODE : null);

      if (!expectedCode) {
        return NextResponse.json(
          { error: "Email findes ikke. Opret en bruger med din email og en kode." },
          { status: 404 }
        );
      }

      if (code !== expectedCode) {
        return NextResponse.json({ error: "Forkert kode" }, { status: 401 });
      }

      return NextResponse.json(await buildAuthResponse(email, bruger?.isAdmin ?? false));
    }

    return NextResponse.json({ error: "Ukendt handling" }, { status: 400 });
  } catch (error) {
    console.error("Auth API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
