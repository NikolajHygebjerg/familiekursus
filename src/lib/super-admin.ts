export const APP_SUPER_ADMIN_EMAIL = "nh@brandbjerg.dk";

export function isAppSuperAdmin(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === APP_SUPER_ADMIN_EMAIL;
}
