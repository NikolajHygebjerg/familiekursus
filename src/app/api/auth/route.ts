import {
  getFamilyByLogin,
  getBrugerByLogin,
  loginExistsInYearTable,
  hasWorkshopRegistration,
  createAirtableRecord,
  updateAirtableRecord,
  normalizeLoginName,
} from "@/lib/airtable";
import { getKursusYear } from "@/lib/kursus-year";
import { getSupabaseConfigError, isSupabaseConfigured } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const TABLE_BRUGERE = "Brugere";
const BRUGERE_LOGIN_FIELDS = {
  email: "Email",
  brugernavn: "Brugernavn",
  kode: "Kode",
  status: "Brugerstatus",
};

export const dynamic = "force-dynamic";

function parseLogin(raw: string | undefined): string | null {
  const login = normalizeLoginName(raw ?? "");
  return login.length > 0 ? login : null;
}

async function buildAuthResponse(login: string, isAdmin: boolean, adminNavn: string | null = null) {
  const inYearTable = await loginExistsInYearTable(login);
  const familyName = isAdmin ? null : inYearTable ? await getFamilyByLogin(login) : login;
  const needsReg = isAdmin
    ? false
    : !(await hasWorkshopRegistration(login, getKursusYear()));

  return {
    ok: true,
    email: login,
    familyName: isAdmin ? "Kursusleder" : familyName,
    isAdmin,
    adminNavn: isAdmin ? adminNavn : null,
    needsWorkshopRegistration: needsReg,
  };
}

function brugerCreateFields(login: string, code?: string): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    [BRUGERE_LOGIN_FIELDS.email]: login,
    [BRUGERE_LOGIN_FIELDS.brugernavn]: login,
    [BRUGERE_LOGIN_FIELDS.status]: "Bruger",
  };
  const c = code?.trim();
  if (c && c.length >= 4) {
    fields[BRUGERE_LOGIN_FIELDS.kode] = c;
  }
  return fields;
}

function parseOptionalCode(code: string | undefined): {
  provided: boolean;
  value: string;
  invalidShort: boolean;
} {
  const value = code?.trim() ?? "";
  if (!value) return { provided: false, value: "", invalidShort: false };
  if (value.length < 4) return { provided: true, value, invalidShort: true };
  return { provided: true, value, invalidShort: false };
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: getSupabaseConfigError() ?? "Supabase er ikke konfigureret" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { action, email: rawLogin, brugernavn: rawBrugernavn, code } = body as {
      action: "login" | "check" | "create" | "setCode" | "resetCode" | "status";
      email?: string;
      brugernavn?: string;
      code?: string;
    };

    const login = parseLogin(rawBrugernavn ?? rawLogin);
    if (!login) {
      return NextResponse.json({ error: "Brugernavn mangler" }, { status: 400 });
    }

    if (action === "status") {
      const bruger = await getBrugerByLogin(login);
      const isAdmin = bruger?.isAdmin ?? false;
      return NextResponse.json(
        await buildAuthResponse(login, isAdmin, bruger?.adminNavn ?? null)
      );
    }

    if (action === "check") {
      const inYearTable = await loginExistsInYearTable(login);
      const bruger = await getBrugerByLogin(login);
      const hasCode = !!bruger?.code;
      const brugerExists = !!bruger?.recordId;
      const familyName = inYearTable ? await getFamilyByLogin(login) : login;
      const isAdmin = bruger?.isAdmin ?? false;
      const needsReg = isAdmin ? false : !(await hasWorkshopRegistration(login, getKursusYear()));
      const needsSetCode = !hasCode && (brugerExists || inYearTable);

      if (hasCode) {
        return NextResponse.json({
          existsIn2026: inYearTable,
          hasBruger: true,
          needsSetCode: false,
          nextStep: "code" as const,
          familyName,
          isAdmin,
          needsWorkshopRegistration: needsReg,
        });
      }
      if (needsSetCode) {
        return NextResponse.json({
          existsIn2026: inYearTable,
          hasBruger: brugerExists,
          needsSetCode: true,
          nextStep: "setCode" as const,
          familyName,
          isAdmin,
          needsWorkshopRegistration: needsReg,
        });
      }

      return NextResponse.json({
        existsIn2026: inYearTable,
        hasBruger: false,
        needsSetCode: true,
        nextStep: "create" as const,
        familyName,
        isAdmin: false,
        needsWorkshopRegistration: true,
      });
    }

    if (action === "create") {
      if (!code || code.length < 4) {
        return NextResponse.json({ error: "Vælg en kode på mindst 4 tegn" }, { status: 400 });
      }
      const existingBruger = await getBrugerByLogin(login);
      if (existingBruger?.recordId) {
        return NextResponse.json(
          { error: "Du har allerede en bruger med dette brugernavn. Log ind med din kode." },
          { status: 409 }
        );
      }
      await createAirtableRecord(TABLE_BRUGERE, brugerCreateFields(login, code));
      return NextResponse.json(await buildAuthResponse(login, false));
    }

    if (action === "resetCode") {
      if (!code || code.length < 4) {
        return NextResponse.json({ error: "Vælg en ny kode på mindst 4 tegn" }, { status: 400 });
      }
      const bruger = await getBrugerByLogin(login);
      if (!bruger?.recordId) {
        return NextResponse.json({ error: "Ingen bruger fundet med dette brugernavn" }, { status: 404 });
      }
      await updateAirtableRecord(TABLE_BRUGERE, bruger.recordId, {
        [BRUGERE_LOGIN_FIELDS.kode]: code,
      });
      return NextResponse.json(await buildAuthResponse(login, bruger.isAdmin, bruger.adminNavn));
    }

    if (action === "setCode") {
      if (!code || code.length < 4) {
        return NextResponse.json({ error: "Vælg en kode på mindst 4 tegn" }, { status: 400 });
      }
      const bruger = await getBrugerByLogin(login);
      if (bruger?.code) {
        return NextResponse.json({ error: "Du har allerede en kode. Log ind med den." }, { status: 400 });
      }
      if (bruger?.recordId) {
        await updateAirtableRecord(TABLE_BRUGERE, bruger.recordId, {
          [BRUGERE_LOGIN_FIELDS.kode]: code,
        });
        return NextResponse.json(await buildAuthResponse(login, bruger.isAdmin, bruger.adminNavn));
      }

      await createAirtableRecord(TABLE_BRUGERE, brugerCreateFields(login, code));
      return NextResponse.json(await buildAuthResponse(login, false));
    }

    if (action === "login") {
      const parsed = parseOptionalCode(code);
      if (parsed.invalidShort) {
        return NextResponse.json(
          { error: "Koden skal være mindst 4 tegn — eller lad feltet stå tomt." },
          { status: 400 }
        );
      }

      const bruger = await getBrugerByLogin(login);

      if (bruger?.code) {
        if (!parsed.provided) {
          return NextResponse.json({ error: "Indtast din kode" }, { status: 400 });
        }
        if (parsed.value !== bruger.code) {
          return NextResponse.json({ error: "Forkert kode" }, { status: 401 });
        }
        return NextResponse.json(await buildAuthResponse(login, bruger.isAdmin, bruger.adminNavn));
      }

      if (bruger?.recordId) {
        if (parsed.provided) {
          await updateAirtableRecord(TABLE_BRUGERE, bruger.recordId, {
            [BRUGERE_LOGIN_FIELDS.kode]: parsed.value,
          });
        }
        return NextResponse.json(await buildAuthResponse(login, bruger.isAdmin, bruger.adminNavn));
      }

      await createAirtableRecord(TABLE_BRUGERE, brugerCreateFields(login, parsed.value || undefined));
      return NextResponse.json(await buildAuthResponse(login, false));
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
