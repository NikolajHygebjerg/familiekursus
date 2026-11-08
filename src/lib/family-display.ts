/** Visningsnavn for familie — ikke kontakt-e-mail fra databasen. */
export function isEmailLike(value: string): boolean {
  return value.includes("@");
}

export function familyDisplayName(
  login: string | null | undefined,
  familyName: string | null | undefined,
  isAdmin: boolean
): string | null {
  if (!login?.trim()) return null;
  if (isAdmin) return "Kursusleder";

  const fam = familyName?.trim();
  if (fam && fam !== "Kursusleder" && !isEmailLike(fam)) return fam;

  const log = login.trim();
  if (!isEmailLike(log)) return log;

  return null;
}
