import { isAppSuperAdmin } from "@/lib/super-admin";

export const BRUGERNAVN_AT_GDPR_MESSAGE =
  "Brugernavn må ikke indeholde @. Vi bruger ikke e-mail som login af hensyn til GDPR — vælg fx jeres familienavn eller et navn uden @.";

export function normalizeBrugernavn(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Klient-side: afvis @ i brugernavn med GDPR-forklaring. */
export function rejectAtInBrugernavn(raw: string): string | null {
  const login = normalizeBrugernavn(raw);
  if (!login) return "Angiv et brugernavn";
  if (login.includes("@")) return BRUGERNAVN_AT_GDPR_MESSAGE;
  return null;
}

/** Server-side: samme regel, med undtagelse for hardcodet super-admin (legacy). */
export function validateBrugernavn(
  raw: string | undefined
): { ok: true; login: string } | { ok: false; error: string } {
  const login = normalizeBrugernavn(raw ?? "");
  if (!login) {
    return { ok: false, error: "Brugernavn mangler" };
  }
  if (login.includes("@") && !isAppSuperAdmin(login)) {
    return { ok: false, error: BRUGERNAVN_AT_GDPR_MESSAGE };
  }
  return { ok: true, login };
}
