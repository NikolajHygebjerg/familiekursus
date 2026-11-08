export const LOGIN_HISTORY_KEY = "familiekursus_login_history";
export const MAX_HISTORY = 12;

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

export function readLoginHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw =
      localStorage.getItem(LOGIN_HISTORY_KEY) ||
      localStorage.getItem("familiekursus_login_email_history");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function pushLoginHistory(prev: string[], login: string): string[] {
  const value = login.trim();
  if (!value) return prev;
  const next = [value, ...prev.filter((x) => x !== value)].slice(0, MAX_HISTORY);
  localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(next));
  return next;
}
