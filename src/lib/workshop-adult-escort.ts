export const ADULT_MIN_AGE = 18;
/** Standard: børn under 10 skal have voksen på samme workshop. */
export const YOUNG_CHILD_AGE_MAX_EXCLUSIVE = 10;

export const ESCORT_WORKSHOP_SLOTS = ["workshop1", "workshop2", "workshop3", "workshop4"] as const;
export type EscortWorkshopSlot = (typeof ESCORT_WORKSHOP_SLOTS)[number];

export interface RosterMember {
  navn: string;
  alder: number | null;
  type?: string | null;
}

export type WorkshopChoiceDraft = Record<string, Partial<Record<EscortWorkshopSlot, string>>>;

/** Ekstern ledsager (anden familie), per barn og workshop-slot. */
export type ExternalEscortDraft = Record<string, Partial<Record<EscortWorkshopSlot, string>>>;

export interface AdultEscortGap {
  childNavn: string;
  slot: EscortWorkshopSlot;
  workshopName: string;
  /** Alder under hvilken voksen kræves for denne workshop. */
  adultRequiredBelowAge: number;
}

export interface WorkshopMinAgeViolation {
  navn: string;
  slot: EscortWorkshopSlot;
  workshopName: string;
  minAge: number;
  actualAge: number | null;
}

interface WorkshopSpecificAgeRule {
  minAge: number;
  adultRequiredBelowAge: number | null;
}

function normalizeWorkshopName(name: string): string {
  return name
    .replace(/[\u2028\u2029]/g, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Workshop-specifikke aldersregler (nøgle = normaliseret workshopsnavn). */
const WORKSHOP_AGE_RULES: Record<string, WorkshopSpecificAgeRule> = {
  adventurerace: { minAge: 10, adultRequiredBelowAge: 15 },
};

export function getWorkshopAgeRule(workshopDisplayName: string): WorkshopSpecificAgeRule | null {
  const key = normalizeWorkshopName(workshopDisplayName);
  return WORKSHOP_AGE_RULES[key] ?? null;
}

export function memberIsAdult(member: RosterMember): boolean {
  if (member.alder != null && member.alder >= ADULT_MIN_AGE) return true;
  return member.type?.trim().toLowerCase() === "voksen";
}

export function memberIsYoungChild(member: RosterMember): boolean {
  return member.alder != null && member.alder < YOUNG_CHILD_AGE_MAX_EXCLUSIVE;
}

/** Om deltageren må vælge workshoppen (fx Adventurerace kræver min. 10 år). */
export function isWorkshopBlockedForMember(
  member: RosterMember,
  workshopDisplayName: string
): boolean {
  const rule = getWorkshopAgeRule(workshopDisplayName);
  if (!rule || member.alder == null) return false;
  return member.alder < rule.minAge;
}

export function memberNeedsAdultOnWorkshop(
  member: RosterMember,
  workshopDisplayName: string
): boolean {
  if (memberIsAdult(member) || member.alder == null) return false;

  const rule = getWorkshopAgeRule(workshopDisplayName);
  if (rule) {
    if (member.alder < rule.minAge) return false;
    if (rule.adultRequiredBelowAge != null && member.alder < rule.adultRequiredBelowAge) {
      return true;
    }
    return false;
  }

  return member.alder < YOUNG_CHILD_AGE_MAX_EXCLUSIVE;
}

export function adultRequiredBelowAgeForWorkshop(workshopDisplayName: string): number {
  const rule = getWorkshopAgeRule(workshopDisplayName);
  if (rule?.adultRequiredBelowAge != null) return rule.adultRequiredBelowAge;
  return YOUNG_CHILD_AGE_MAX_EXCLUSIVE;
}

export function formatExternalEscortLabel(voksenNavn: string): string {
  const name = voksenNavn.trim();
  return `følges med ${name} fra anden familie`;
}

export function parseExternalEscortName(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null;
  const match = stored.match(/følges med (.+?) fra anden familie/i);
  return match ? match[1].trim() : null;
}

export function listWorkshopMinAgeViolations(
  members: RosterMember[],
  workshopDraft: WorkshopChoiceDraft
): WorkshopMinAgeViolation[] {
  const violations: WorkshopMinAgeViolation[] = [];

  for (const member of members) {
    const choices = workshopDraft[member.navn];
    if (!choices) continue;

    for (const slot of ESCORT_WORKSHOP_SLOTS) {
      const workshopName = choices[slot]?.trim();
      if (!workshopName) continue;
      const rule = getWorkshopAgeRule(workshopName);
      if (!rule || member.alder == null) continue;
      if (member.alder < rule.minAge) {
        violations.push({
          navn: member.navn,
          slot,
          workshopName,
          minAge: rule.minAge,
          actualAge: member.alder,
        });
      }
    }
  }

  return violations;
}

/** Alder/type fra klient når databasen mangler felter endnu. */
export function mergeRosterWithClientMembers<T extends RosterMember>(
  roster: T[],
  client: Array<{ navn: string; alder?: number | null; type?: string | null }>
): T[] {
  const byNavn = new Map(client.map((c) => [c.navn.trim().toLowerCase(), c]));
  return roster.map((member) => {
    const fromClient = byNavn.get(member.navn.trim().toLowerCase());
    if (!fromClient) return member;
    return {
      ...member,
      alder: member.alder ?? (fromClient.alder != null ? fromClient.alder : null),
      type: member.type ?? fromClient.type ?? null,
    };
  });
}

export function listAdultEscortGaps(
  members: RosterMember[],
  workshopDraft: WorkshopChoiceDraft,
  externalEscorts: ExternalEscortDraft
): AdultEscortGap[] {
  const adults = members.filter(memberIsAdult);
  const gaps: AdultEscortGap[] = [];

  for (const member of members) {
    if (memberIsAdult(member)) continue;
    const choices = workshopDraft[member.navn];
    if (!choices) continue;

    for (const slot of ESCORT_WORKSHOP_SLOTS) {
      const workshopName = choices[slot]?.trim();
      if (!workshopName) continue;
      if (!memberNeedsAdultOnWorkshop(member, workshopName)) continue;

      const external = externalEscorts[member.navn]?.[slot]?.trim();
      if (external) continue;

      const workshopNorm = normalizeWorkshopName(workshopName);
      const hasFamilyAdultOnWorkshop = adults.some((adult) => {
        const adultChoice = workshopDraft[adult.navn]?.[slot]?.trim();
        return adultChoice != null && normalizeWorkshopName(adultChoice) === workshopNorm;
      });
      if (!hasFamilyAdultOnWorkshop) {
        gaps.push({
          childNavn: member.navn,
          slot,
          workshopName,
          adultRequiredBelowAge: adultRequiredBelowAgeForWorkshop(workshopName),
        });
      }
    }
  }

  return gaps;
}

export const ESCORT_SLOT_LABELS: Record<EscortWorkshopSlot, string> = {
  workshop1: "Workshop 1",
  workshop2: "Workshop 2",
  workshop3: "Workshop 3",
  workshop4: "Workshop 4",
};
