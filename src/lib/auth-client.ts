export type AuthResult = {
  email: string;
  familyName: string | null;
  isAdmin?: boolean;
  adminNavn?: string | null;
  needsWorkshopRegistration?: boolean;
};

export function postLoginPath(data: AuthResult): string {
  if (data.isAdmin) return "/";
  if (data.needsWorkshopRegistration) return "/workshop-tilmelding";
  return "/tilmeldte";
}

const LEGACY_LOGIN_HISTORY_KEYS = [
  "familiekursus_login_history",
  "familiekursus_login_email_history",
] as const;

/** Fjern gamle gemte brugernavne fra localStorage. */
export function clearLegacyLoginHistory(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_LOGIN_HISTORY_KEYS) {
    localStorage.removeItem(key);
  }
}
