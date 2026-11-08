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

/** Barn deltager uden voksen på slot (kun når alder/workshop tillader det). */
export type SoloWithoutAdultDraft = Record<string, Partial<Record<EscortWorkshopSlot, boolean>>>;

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

/** Kun børn under 10 må have ledsager fra anden familie. */
export function childAllowsExternalFamilyEscort(member: RosterMember): boolean {
  if (memberIsAdult(member)) return false;
  if (member.alder == null) return true;
  return member.alder < YOUNG_CHILD_AGE_MAX_EXCLUSIVE;
}

/** Børn 10+ skal aktivt vælge voksen fra familien eller «uden voksen» pr. hold. */
export function childMustConfirmEscortPerSlot(member: RosterMember): boolean {
  return !memberIsAdult(member) && member.alder != null && member.alder >= YOUNG_CHILD_AGE_MAX_EXCLUSIVE;
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

/** Om barnet må krydse «Deltager uden voksen» for den valgte workshop. */
export function childCanAttendWorkshopWithoutAdult(
  member: RosterMember,
  workshopDisplayName: string
): boolean {
  if (memberIsAdult(member) || member.alder == null) return false;
  const name = workshopDisplayName.trim();
  if (!name) return false;
  const rule = getWorkshopAgeRule(name);
  if (rule?.adultRequiredBelowAge != null) {
    return member.alder >= rule.adultRequiredBelowAge;
  }
  return member.alder >= YOUNG_CHILD_AGE_MAX_EXCLUSIVE;
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

/** Voksne der enten er frie på slot, eller allerede tilmeldt præcis denne workshop. */
export function filterAdultsAvailableForEscortSlot(
  adults: RosterMember[],
  workshopDraft: WorkshopChoiceDraft,
  slot: EscortWorkshopSlot,
  workshopDisplayName: string
): RosterMember[] {
  const target = normalizeWorkshopName(workshopDisplayName);
  return adults.filter((adult) => {
    const choice = workshopDraft[adult.navn]?.[slot]?.trim();
    if (!choice) return true;
    return normalizeWorkshopName(choice) === target;
  });
}

export function findFamilyAdultOnChildSlot(
  adults: RosterMember[],
  workshopDraft: WorkshopChoiceDraft,
  slot: EscortWorkshopSlot,
  workshopDisplayName: string
): string | null {
  const target = normalizeWorkshopName(workshopDisplayName);
  for (const adult of adults) {
    const choice = workshopDraft[adult.navn]?.[slot]?.trim();
    if (choice && normalizeWorkshopName(choice) === target) return adult.navn;
  }
  return null;
}

export function listAdultEscortGaps(
  members: RosterMember[],
  workshopDraft: WorkshopChoiceDraft,
  externalEscorts: ExternalEscortDraft,
  soloWithoutAdult: SoloWithoutAdultDraft = {}
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
      if (soloWithoutAdult[member.navn]?.[slot]) continue;

      const external = externalEscorts[member.navn]?.[slot]?.trim();
      if (external && childAllowsExternalFamilyEscort(member)) continue;

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

export function isChildEscortSlotResolved(
  member: RosterMember,
  slot: EscortWorkshopSlot,
  workshopName: string,
  adults: RosterMember[],
  workshopDraft: WorkshopChoiceDraft,
  externalEscorts: ExternalEscortDraft,
  soloWithoutAdult: SoloWithoutAdultDraft
): boolean {
  if (soloWithoutAdult[member.navn]?.[slot]) return true;

  if (childAllowsExternalFamilyEscort(member)) {
    const external = externalEscorts[member.navn]?.[slot]?.trim();
    if (external) return true;
  }

  const workshopNorm = normalizeWorkshopName(workshopName);
  const hasFamilyAdultOnWorkshop = adults.some((adult) => {
    if (!memberIsAdult(adult)) return false;
    const adultChoice = workshopDraft[adult.navn]?.[slot]?.trim();
    return adultChoice != null && normalizeWorkshopName(adultChoice) === workshopNorm;
  });
  if (hasFamilyAdultOnWorkshop) return true;

  if (memberNeedsAdultOnWorkshop(member, workshopName)) return false;
  if (childMustConfirmEscortPerSlot(member)) return false;

  return true;
}

export function listChildEscortDecisionGaps(
  members: RosterMember[],
  workshopDraft: WorkshopChoiceDraft,
  externalEscorts: ExternalEscortDraft,
  soloWithoutAdult: SoloWithoutAdultDraft = {}
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
      if (
        isChildEscortSlotResolved(
          member,
          slot,
          workshopName,
          adults,
          workshopDraft,
          externalEscorts,
          soloWithoutAdult
        )
      ) {
        continue;
      }
      gaps.push({
        childNavn: member.navn,
        slot,
        workshopName,
        adultRequiredBelowAge: adultRequiredBelowAgeForWorkshop(workshopName),
      });
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
