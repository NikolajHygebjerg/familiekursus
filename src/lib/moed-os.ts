import { MOED_OS_PEOPLE, MOED_OS_TITLE, type MoedOsPerson } from "@/data/moed-os";
import type { MoedOsAirtableOverride, MoedOsAirtableState } from "@/lib/airtable";

export const MOED_OS_SUPER_ADMIN_EMAIL = "nh@brandbjerg.dk";
export const MOED_OS_PLACEHOLDER_IMAGE = "/images/moed-os/placeholder.svg";

export interface MoedOsPersonView {
  slug: string;
  name: string;
  image: string;
  recordId: string | null;
  canEdit: boolean;
  canEditName: boolean;
  canDelete: boolean;
  isCustom: boolean;
}

export function slugFromMoedOsImage(image: string): string {
  const file = image.split("/").pop() || "";
  return file.replace(/\.[a-z]+$/i, "").toLowerCase();
}

export function slugFromPersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getStaticMoedOsSlugs(): Set<string> {
  return new Set(MOED_OS_PEOPLE.map((person) => slugFromMoedOsImage(person.image)));
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

function buildPersonView(
  person: {
    slug: string;
    name: string;
    image: string;
    recordId: string | null;
    linkedEmail: string | null;
    isCustom: boolean;
  },
  viewerEmail: string | null,
  adminNavn: string | null,
  isAdmin: boolean,
  superAdmin: boolean
): MoedOsPersonView {
  const merged = {
    name: person.name,
    linkedEmail: person.linkedEmail,
  };

  return {
    slug: person.slug,
    name: person.name,
    image: person.image || MOED_OS_PLACEHOLDER_IMAGE,
    recordId: person.recordId,
    isCustom: person.isCustom,
    canEdit: isAdmin && canAdminEditMoedOsPerson(viewerEmail, adminNavn, merged),
    canEditName: superAdmin,
    canDelete: superAdmin,
  };
}

export function buildMoedOsPersonViews(
  airtableState: MoedOsAirtableState,
  viewerEmail: string | null,
  adminNavn: string | null,
  isAdmin: boolean
): MoedOsPersonView[] {
  const superAdmin = isAdmin && isMoedOsSuperAdmin(viewerEmail);
  const result: MoedOsPersonView[] = [];

  for (const person of MOED_OS_PEOPLE) {
    const slug = slugFromMoedOsImage(person.image);
    if (airtableState.hiddenSlugs.has(slug)) continue;

    const override = airtableState.overrides.get(slug);
    result.push(
      buildPersonView(
        {
          slug,
          name: override?.name ?? person.name,
          image: override?.image?.trim() ? override.image : person.image,
          recordId: override?.recordId ?? null,
          linkedEmail: override?.linkedEmail ?? null,
          isCustom: false,
        },
        viewerEmail,
        adminNavn,
        isAdmin,
        superAdmin
      )
    );
  }

  for (const custom of airtableState.customPeople) {
    result.push(
      buildPersonView(
        {
          slug: custom.slug,
          name: custom.name,
          image: custom.image,
          recordId: custom.recordId,
          linkedEmail: custom.linkedEmail,
          isCustom: true,
        },
        viewerEmail,
        adminNavn,
        isAdmin,
        superAdmin
      )
    );
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "da"));
}

export function isStaticMoedOsSlug(slug: string): boolean {
  return getStaticMoedOsSlugs().has(slug.trim().toLowerCase());
}

export function resolveMoedOsPersonForUpload(
  slug: string,
  airtableState: MoedOsAirtableState
): { name: string; linkedEmail: string | null; isStatic: boolean } | null {
  const normalizedSlug = slug.trim().toLowerCase();
  const staticPerson = MOED_OS_PEOPLE.find(
    (person) => slugFromMoedOsImage(person.image) === normalizedSlug
  );
  const override = airtableState.overrides.get(normalizedSlug);
  const custom = airtableState.customPeople.find((person) => person.slug === normalizedSlug);

  if (airtableState.hiddenSlugs.has(normalizedSlug)) return null;

  if (staticPerson) {
    return {
      name: override?.name ?? staticPerson.name,
      linkedEmail: override?.linkedEmail ?? null,
      isStatic: true,
    };
  }

  if (custom) {
    return {
      name: custom.name,
      linkedEmail: custom.linkedEmail,
      isStatic: false,
    };
  }

  return null;
}

export { MOED_OS_TITLE, MOED_OS_PEOPLE, type MoedOsPerson, type MoedOsAirtableOverride };
