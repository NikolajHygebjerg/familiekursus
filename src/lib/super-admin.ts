export const APP_SUPER_ADMIN_EMAIL = "nh@brandbjerg.dk";

export function isAppSuperAdmin(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === APP_SUPER_ADMIN_EMAIL;
}

/** Første gangs / gendannet super-admin-kode (overstyres med KURSUSLEDER_BOOTSTRAP_CODE). */
export function getAppSuperAdminBootstrapCode(): string {
  const fromEnv = process.env.KURSUSLEDER_BOOTSTRAP_CODE?.trim();
  if (fromEnv && fromEnv.length >= 4) return fromEnv;
  return "Design86930881";
}
