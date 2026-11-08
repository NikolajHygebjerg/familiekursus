import {
  deleteFamilyByLogin,
  getFamilyByLogin,
  getBrugerByLogin,
  loginExistsInYearTable,
  hasCompletedWorkshopRegistration,
  createAirtableRecord,
  isFamilySelfDeleteCode,
  updateAirtableRecord,
  upsertAppSuperAdminBruger,
  normalizeLoginName,
} from "@/lib/airtable";
import {
  getAppSuperAdminBootstrapCode,
  isAppSuperAdmin,
} from "@/lib/super-admin";
import { isEmailLike } from "@/lib/family-display";
import {
  issueForgotCodeChildChallenge,
  verifyForgotCodeChildAnswer,
} from "@/lib/forgot-code-challenge";
import { getKursusYear } from "@/lib/kursus-year";
import { validateBrugernavn } from "@/lib/brugernavn";
import { getSupabaseConfigError, isSupabaseConfigured } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const TABLE_BRUGERE = "Brugere";
const BRUGERE_LOGIN_FIELDS = {
  brugernavn: "Brugernavn",
  kode: "Kode",
  status: "Brugerstatus",
};

export const dynamic = "force-dynamic";

async function buildAuthResponse(login: string, isAdmin: boolean, adminNavn: string | null = null) {
  const effectiveAdmin = isAdmin || isAppSuperAdmin(login);
  const inYearTable = await loginExistsInYearTable(login);
  let familyName: string | null = effectiveAdmin
    ? null
    : inYearTable
      ? await getFamilyByLogin(login)
      : login;
  if (!effectiveAdmin && familyName && isEmailLike(familyName)) {
    const loginNorm = normalizeLoginName(login).toLowerCase();
    if (normalizeLoginName(familyName).toLowerCase() !== loginNorm) {
      familyName = login;
    }
  }
  if (!effectiveAdmin && !familyName) {
    familyName = login;
  }
  const needsReg = effectiveAdmin
    ? false
    : !(await hasCompletedWorkshopRegistration(login, getKursusYear()));

  return {
    ok: true,
    email: login,
    familyName: effectiveAdmin ? "Kursusleder" : familyName,
    isAdmin: effectiveAdmin,
    adminNavn: effectiveAdmin ? adminNavn : null,
    needsWorkshopRegistration: needsReg,
  };
}

function brugerCreateFields(login: string, code?: string): Record<string, unknown> {
  const fields: Record<string, unknown> = {
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
    const {
      action,
      email: rawLogin,
      brugernavn: rawBrugernavn,
      code,
      challengeToken,
      barnNavn,
    } = body as {
      action:
        | "login"
        | "check"
        | "create"
        | "setCode"
        | "resetCode"
        | "forgotCodeChallenge"
        | "status";
      email?: string;
      brugernavn?: string;
      code?: string;
      challengeToken?: string;
      barnNavn?: string;
    };

    const parsedLogin = validateBrugernavn(rawBrugernavn ?? rawLogin);
    if (!parsedLogin.ok) {
      return NextResponse.json({ error: parsedLogin.error }, { status: 400 });
    }
    const login = parsedLogin.login;

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
      const needsReg = isAdmin ? false : !(await hasCompletedWorkshopRegistration(login, getKursusYear()));
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

    if (action === "forgotCodeChallenge") {
      const bruger = await getBrugerByLogin(login);
      if (!bruger?.recordId) {
        return NextResponse.json({ error: "Ingen bruger fundet med dette brugernavn" }, { status: 404 });
      }
      const challenge = await issueForgotCodeChildChallenge(login);
      if ("error" in challenge) {
        return NextResponse.json({ error: challenge.error }, { status: challenge.status });
      }
      return NextResponse.json({
        ok: true,
        alder: challenge.alder,
        challengeToken: challenge.challengeToken,
      });
    }

    if (action === "resetCode") {
      if (!code || code.length < 4) {
        return NextResponse.json({ error: "Vælg en ny kode på mindst 4 tegn" }, { status: 400 });
      }
      const token = challengeToken?.trim();
      const answer = barnNavn?.trim();
      if (!token || !answer) {
        return NextResponse.json(
          { error: "Besvar sikkerhedsspørgsmålet om barnets fornavn før du vælger ny kode." },
          { status: 400 }
        );
      }
      if (!verifyForgotCodeChildAnswer(login, token, answer)) {
        return NextResponse.json(
          { error: "Forkert fornavn. Prøv igen, eller kontakt kursuslederen." },
          { status: 403 }
        );
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

      if (parsed.provided && isFamilySelfDeleteCode(parsed.value)) {
        const bruger = await getBrugerByLogin(login);
        if (bruger?.isAdmin || isAppSuperAdmin(login)) {
          return NextResponse.json(
            { error: "Kursusleder-konto kan ikke slettes med koden Slet." },
            { status: 403 }
          );
        }
        const inYear = await loginExistsInYearTable(login);
        const hasBruger = Boolean(bruger?.recordId);
        if (!inYear && !hasBruger) {
          return NextResponse.json(
            { error: "Ingen familie eller bruger fundet med det brugernavn." },
            { status: 404 }
          );
        }
        const result = await deleteFamilyByLogin(login);
        return NextResponse.json({
          ok: true,
          deleted: true,
          message:
            "Familien er afmeldt. Workshoppladser er frigivet, og brugernavnet kan tilmeldes igen.",
          deletedParticipantRows: result.deletedParticipantRows,
          deletedBrugerRows: result.deletedBrugerRows,
        });
      }

      if (isAppSuperAdmin(login)) {
        const bruger = await getBrugerByLogin(login);
        const expectedCode = bruger?.code?.trim() || getAppSuperAdminBootstrapCode();
        if (!parsed.provided) {
          return NextResponse.json({ error: "Indtast din kode" }, { status: 400 });
        }
        if (parsed.value !== expectedCode) {
          return NextResponse.json({ error: "Forkert kode" }, { status: 401 });
        }
        await upsertAppSuperAdminBruger(login, parsed.value);
        const updated = await getBrugerByLogin(login);
        return NextResponse.json(
          await buildAuthResponse(login, true, updated?.adminNavn ?? "Nikolaj")
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
