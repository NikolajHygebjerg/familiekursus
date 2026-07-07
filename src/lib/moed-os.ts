import { MOED_OS_PEOPLE, MOED_OS_TITLE, type MoedOsPerson } from "@/data/moed-os";

export const MOED_OS_SUPER_ADMIN_EMAIL = "nh@brandbjerg.dk";

export interface MoedOsPersonView extends MoedOsPerson {
  slug: string;
  recordId: string | null;
  canEdit: boolean;
  canEditName: boolean;
}

export function slugFromMoedOsImage(image: string): string {
  const file = image.split("/").pop() || "";
  return file.replace(/\.[a-z]+$/i, "").toLowerCase();
}

function normalizePersonName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function personNameMatches(adminNavn: string, displayName: string): boolean {
  const adminNorm = normalizePersonName(adminNavn);
  const staffNorm = normalizePersonName(displayName);
  if (!adminNorm || !staffNorm) return false;
  if (adminNorm === staffNorm) return true;
  return (
    staffNorm.startsWith(`${adminNorm} `) ||
    staffNorm.startsWith(`${adminNorm}.`) ||
    adminNorm.startsWith(`${staffNorm} `) ||
    adminNorm.startsWith(`${staffNorm}.`)
  );
}

export function isMoedOsSuperAdmin(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === MOED_OS_SUPER_ADMIN_EMAIL;
}

export function canAdminEditMoedOsPerson(
  email: string | null | undefined,
  adminNavn: string | null | undefined,
  person: { name: string; linkedEmail?: string | null }
): boolean {
  if (isMoedOsSuperAdmin(email)) return true;
  if (!email || !adminNavn?.trim()) return false;
  if (person.linkedEmail?.trim().toLowerCase() === email.trim().toLowerCase()) return true;
  return personNameMatches(adminNavn, person.name);
}

export function buildMoedOsPersonViews(
  people: MoedOsPerson[],
  overrides: Map<
    string,
    { name: string; image: string; recordId: string; linkedEmail: string | null }
  >,
  viewerEmail: string | null,
  adminNavn: string | null,
  isAdmin: boolean
): MoedOsPersonView[] {
  const superAdmin = isAdmin && isMoedOsSuperAdmin(viewerEmail);

  return people.map((person) => {
    const slug = slugFromMoedOsImage(person.image);
    const override = overrides.get(slug);
    const merged = {
      slug,
      name: override?.name ?? person.name,
      image: override?.image ?? person.image,
      recordId: override?.recordId ?? null,
      linkedEmail: override?.linkedEmail ?? null,
    };

    const canEdit =
      isAdmin && canAdminEditMoedOsPerson(viewerEmail, adminNavn, merged);
    const canEditName = superAdmin;

    return {
      slug: merged.slug,
      name: merged.name,
      image: merged.image,
      recordId: merged.recordId,
      canEdit,
      canEditName,
    };
  });
}

export { MOED_OS_TITLE, MOED_OS_PEOPLE };
