import {
  getFamilyByEmail,
  getBrugerCode,
  getBrugerRecordId,
  brugerExistsInBrugere,
  emailExistsIn2026,
  hasWorkshopRegistration,
  createAirtableRecord,
  updateAirtableRecord,
} from "@/lib/airtable";

const ADMIN_EMAIL = "nh@brandbjerg.dk";
const ADMIN_CODE = "Design86930881";
const DEFAULT_CODE = "1234";
import { NextResponse } from "next/server";

const TABLE_BRUGERE = "Brugere";
const BRUGERE_EMAIL_FIELDS = ["Email", "email", "A Email"];
const BRUGERE_KODE_FIELDS = ["Kode", "kode", "Code", "code"];

function getYear(): number {
  return new Date().getFullYear();
}

export const dynamic = "force-dynamic";

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

    // Admin login
    if (email === ADMIN_EMAIL.toLowerCase()) {
      if (action === "login" && code === ADMIN_CODE) {
        return NextResponse.json({
          ok: true,
          email,
          familyName: "Kursusleder",
          isAdmin: true,
          needsWorkshopRegistration: false,
        });
      }
      if (action === "login") {
        return NextResponse.json({ error: "Forkert kode" }, { status: 401 });
      }
    }

    if (action === "check") {
      const existsIn2026 = await emailExistsIn2026(email);
      const brugerCode = await getBrugerCode(email);
      const brugerExists = await brugerExistsInBrugere(email);
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
      const existingBruger = await getBrugerRecordId(email);
      if (existingBruger) {
        return NextResponse.json(
          { error: "Du har allerede en bruger med denne email. Log ind med din kode eller brug 'Glemt kode?'" },
          { status: 409 }
        );
      }
      try {
        await createAirtableRecord(TABLE_BRUGERE, {
          [BRUGERE_EMAIL_FIELDS[0]]: email,
          [BRUGERE_KODE_FIELDS[0]]: code,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Kunne ikke oprette bruger";
        if (msg.includes("duplicate") || msg.includes("already")) {
          return NextResponse.json({ error: "Denne email er allerede oprettet" }, { status: 409 });
        }
        throw e;
      }
      const familyName = await getFamilyByEmail(email);
      const needsReg = !(await hasWorkshopRegistration(email, getYear()));
      return NextResponse.json({
        ok: true,
        email,
        familyName,
        isAdmin: false,
        needsWorkshopRegistration: needsReg,
      });
    }

    if (action === "resetCode") {
      if (!code || code.length < 4) {
        return NextResponse.json({ error: "Vælg en ny kode på mindst 4 tegn" }, { status: 400 });
      }
      const recordId = await getBrugerRecordId(email);
      if (!recordId) {
        return NextResponse.json({ error: "Ingen bruger fundet med denne email" }, { status: 404 });
      }
      await updateAirtableRecord(TABLE_BRUGERE, recordId, {
        [BRUGERE_KODE_FIELDS[0]]: code,
      });
      const familyName = await getFamilyByEmail(email);
      const needsReg = !(await hasWorkshopRegistration(email, getYear()));
      return NextResponse.json({
        ok: true,
        email,
        familyName,
        isAdmin: false,
        needsWorkshopRegistration: needsReg,
      });
    }

    if (action === "setCode") {
      if (!code || code.length < 4) {
        return NextResponse.json({ error: "Vælg en kode på mindst 4 tegn" }, { status: 400 });
      }
      const brugerCode = await getBrugerCode(email);
      if (brugerCode) {
        return NextResponse.json({ error: "Du har allerede en kode. Log ind med den." }, { status: 400 });
      }
      const existingRecordId = await getBrugerRecordId(email);
      if (existingRecordId) {
        await updateAirtableRecord(TABLE_BRUGERE, existingRecordId, {
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
        });
      }
      const familyName = await getFamilyByEmail(email);
      const needsReg = !(await hasWorkshopRegistration(email, getYear()));
      return NextResponse.json({
        ok: true,
        email,
        familyName,
        isAdmin: false,
        needsWorkshopRegistration: needsReg,
      });
    }

    if (action === "login") {
      const brugerCode = await getBrugerCode(email);
      const existsIn2026 = await emailExistsIn2026(email);
      const expectedCode = brugerCode ?? (existsIn2026 ? DEFAULT_CODE : null);

      if (!expectedCode) {
        return NextResponse.json(
          { error: "Email findes ikke. Opret en bruger med din email og en kode." },
          { status: 404 }
        );
      }

      if (code !== expectedCode) {
        return NextResponse.json({ error: "Forkert kode" }, { status: 401 });
      }

      const familyName = existsIn2026 ? await getFamilyByEmail(email) : null;
      const needsReg = existsIn2026
        ? !(await hasWorkshopRegistration(email, getYear()))
        : true;

      return NextResponse.json({
        ok: true,
        email,
        familyName,
        isAdmin: false,
        needsWorkshopRegistration: needsReg,
      });
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
