import {
  createAirtableRecord,
  deleteAirtableRecord,
  getFamilyMembersByLogin,
  markBrugerWorkshopsTilmeldt,
  getParticipantFieldResolvers,
  getParticipantRecordIdsByLogin,
  getYearTableId,
  hasWorkshopRegistration,
  listParticipantRecordIdsForName,
  normalizeLoginName,
  normalizeMemberName,
  updateAirtableRecord,
  type WorkshopSlotKey,
} from "@/lib/airtable";
import {
  type EscortWorkshopSlot,
  type ExternalEscortDraft,
  type WorkshopChoiceDraft,
  childAllowsExternalFamilyEscort,
  formatExternalEscortLabel,
  listAdultEscortGaps,
  listWorkshopMinAgeViolations,
  mergeRosterWithClientMembers,
} from "@/lib/workshop-adult-escort";
import { validateWorkshopPicksForLogin } from "@/lib/workshop-capacity";
import { getKursusYear } from "@/lib/kursus-year";
import { NextResponse } from "next/server";

const NAVN_FIELDS = ["Navn", "navn", "Name", "name"];
const EMAIL_FIELDS = ["Email", "email", "A Email"];
const BRUGERNAVN_FIELDS = ["Brugernavn", "brugernavn", "Login", "login"];
const FAMILIE_FIELDS = ["Familie", "familie", "Family", "family"];
const ALDER_FIELDS = ["Alder", "A Alder", "#Alder", "alder", "Age", "age"];
const BARN_VOKSEN_FIELDS = ["Barn/voksen", "Barn/Voksen", "barn_voksen"];

type MemberWorkshops = {
  navn: string;
  alder?: number | null;
  type?: string | null;
  workshop1?: string;
  workshop2?: string;
  workshop3?: string;
  workshop4?: string;
  voksen?: string;
  ledsager1?: string;
  ledsager2?: string;
  ledsager3?: string;
  ledsager4?: string;
};

function buildWorkshopDraftFromPayload(members: MemberWorkshops[]): WorkshopChoiceDraft {
  const draft: WorkshopChoiceDraft = {};
  for (const m of members) {
    draft[m.navn] = {
      workshop1: m.workshop1?.trim() || "",
      workshop2: m.workshop2?.trim() || "",
      workshop3: m.workshop3?.trim() || "",
      workshop4: m.workshop4?.trim() || "",
    };
  }
  return draft;
}

const LEDSAGER_PAYLOAD_KEY: Record<
  EscortWorkshopSlot,
  "ledsager1" | "ledsager2" | "ledsager3" | "ledsager4"
> = {
  workshop1: "ledsager1",
  workshop2: "ledsager2",
  workshop3: "ledsager3",
  workshop4: "ledsager4",
};

function rosterMemberPayload(
  fornavn: string,
  alderNum: number,
  type: string
): Record<string, string | number | null> {
  return {
    navn: fornavn,
    alder: alderNum,
    type,
    workshop1: null,
    workshop2: null,
    workshop3: null,
    workshop4: null,
    voksen: null,
    ledsager1: null,
    ledsager2: null,
    ledsager3: null,
    ledsager4: null,
  };
}

function buildExternalEscortsFromPayload(members: MemberWorkshops[]): ExternalEscortDraft {
  const external: ExternalEscortDraft = {};
  const slots: EscortWorkshopSlot[] = ["workshop1", "workshop2", "workshop3", "workshop4"];
  for (const m of members) {
    for (const slot of slots) {
      const raw = m[LEDSAGER_PAYLOAD_KEY[slot]]?.trim();
      if (!raw) continue;
      if (!external[m.navn]) external[m.navn] = {};
      external[m.navn][slot] = raw;
    }
  }
  return external;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = (body.mode as string | undefined) || "roster";
    const email = (body.email as string | undefined)?.trim();

    if (!email) {
      return NextResponse.json({ error: "Brugernavn mangler" }, { status: 400 });
    }

    const year = getKursusYear();
    const tableId = getYearTableId(year);
    const login = normalizeLoginName(email);

    if (mode === "workshops") {
      const fieldResolvers = await getParticipantFieldResolvers(tableId);
      const alreadyRegistered = await hasWorkshopRegistration(login, year);
      if (alreadyRegistered) {
        return NextResponse.json(
          {
            error:
              "Jeres familie har allerede tilmeldt workshops. Se dem under Tilmeldte i appen.",
            code: "ALREADY_REGISTERED",
          },
          { status: 403 }
        );
      }

      const members = (body.members as MemberWorkshops[] | undefined) || [];
      const acceptPartial = Boolean(body.acceptPartial);
      const partialChoices = (body.partialChoices as Record<string, string[]> | undefined) || {};

      if (members.length === 0) {
        return NextResponse.json({ error: "Ingen deltagere angivet" }, { status: 400 });
      }

      const roster = mergeRosterWithClientMembers(
        await getFamilyMembersByLogin(login),
        members
      );
      const workshopDraft = buildWorkshopDraftFromPayload(members);
      const externalEscorts = buildExternalEscortsFromPayload(members);
      const rosterByNavn = new Map(roster.map((m) => [m.navn.trim().toLowerCase(), m]));
      for (const member of members) {
        const navn = member.navn?.trim();
        if (!navn) continue;
        const rosterMember = rosterByNavn.get(navn.toLowerCase());
        if (!rosterMember) continue;
        const escortSlots: EscortWorkshopSlot[] = ["workshop1", "workshop2", "workshop3", "workshop4"];
        for (const slot of escortSlots) {
          const extName = member[LEDSAGER_PAYLOAD_KEY[slot]]?.trim();
          if (!extName) continue;
          if (!childAllowsExternalFamilyEscort(rosterMember)) {
            return NextResponse.json(
              {
                error: `${navn}: ledsager fra anden familie gælder kun for børn under 10 år. Vælg voksen fra familien eller deltager uden voksen.`,
                code: "ADULT_ESCORT_REQUIRED",
              },
              { status: 409 }
            );
          }
        }
      }
      const minAgeViolations = listWorkshopMinAgeViolations(roster, workshopDraft);
      if (minAgeViolations.length > 0) {
        return NextResponse.json(
          {
            error: "En eller flere workshops har ikke opfyldt minimumsalder.",
            code: "WORKSHOP_MIN_AGE",
            violations: minAgeViolations,
          },
          { status: 409 }
        );
      }

      const escortGaps = listAdultEscortGaps(roster, workshopDraft, externalEscorts);
      if (escortGaps.length > 0) {
        return NextResponse.json(
          {
            error:
              "Nogle børn mangler valg af voksen fra familien (eller deltager uden voksen for 10+). Under 10 år kan der angives ledsager fra anden familie.",
            code: "ADULT_ESCORT_REQUIRED",
            gaps: escortGaps,
          },
          { status: 409 }
        );
      }

      const recordIds = await getParticipantRecordIdsByLogin(login);
      const picks: Array<{ navn: string; slot: WorkshopSlotKey; workshop: string }> = [];

      for (const member of members) {
        const navn = member.navn?.trim();
        if (!navn) continue;
        if (!recordIds.has(navn.toLowerCase())) {
          return NextResponse.json(
            { error: `Deltageren ${navn} findes ikke i jeres familieliste` },
            { status: 400 }
          );
        }
        const slots: WorkshopSlotKey[] = ["workshop1", "workshop2", "workshop3", "workshop4"];
        for (const slot of slots) {
          const value = member[slot]?.trim();
          if (value) picks.push({ navn, slot, workshop: value });
        }
        const v = member.voksen?.trim();
        if (v) picks.push({ navn, slot: "voksen", workshop: v });
      }

      let conflicts = await validateWorkshopPicksForLogin(login, picks, recordIds);

      if (conflicts.length > 0 && !acceptPartial) {
        return NextResponse.json(
          {
            error: "Ikke nok ledige pladser",
            code: "PARTIAL_CAPACITY",
            conflicts,
          },
          { status: 409 }
        );
      }

      const skippedByConflict = new Set<string>();

      if (conflicts.length > 0 && acceptPartial) {
        for (const conflict of conflicts) {
          const key = `${conflict.slot}::${conflict.workshopName}`;
          const allowed = new Set(
            (partialChoices[key] || conflict.memberNames.slice(0, conflict.available)).map((n) =>
              n.toLowerCase()
            )
          );
          for (const name of conflict.memberNames) {
            if (!allowed.has(name.toLowerCase())) {
              skippedByConflict.add(`${name.toLowerCase()}::${conflict.slot}`);
            }
          }
          conflicts = conflicts.filter((c) => c !== conflict);
        }
        const recheck = await validateWorkshopPicksForLogin(login, picks, recordIds);
        if (recheck.length > 0) {
          return NextResponse.json(
            {
              error: "Kunne ikke gennemføre tilmelding med de valgte pladser",
              code: "PARTIAL_CAPACITY",
              conflicts: recheck,
            },
            { status: 409 }
          );
        }
      }

      let updatedCount = 0;
      for (const member of members) {
        const navn = member.navn?.trim();
        if (!navn) continue;
        const recordId = recordIds.get(normalizeMemberName(navn));
        if (!recordId) continue;

        const fields: Record<string, string> = {};
        const slots: WorkshopSlotKey[] = ["workshop1", "workshop2", "workshop3", "workshop4", "voksen"];
        for (const slot of slots) {
          const sk = `${normalizeMemberName(navn)}::${slot}`;
          const fieldKey = fieldResolvers.workshop[slot];
          if (!fieldKey) continue;
          if (skippedByConflict.has(sk)) {
            fields[fieldKey] = "";
            continue;
          }
          const value = member[slot]?.trim();
          if (value) fields[fieldKey] = value;
        }

        const escortSlots: EscortWorkshopSlot[] = ["workshop1", "workshop2", "workshop3", "workshop4"];
        for (const slot of escortSlots) {
          const extName = member[LEDSAGER_PAYLOAD_KEY[slot]]?.trim();
          const ledsagerField = fieldResolvers.ledsager[slot];
          if (!ledsagerField) continue;
          const rosterMember = rosterByNavn.get(navn.toLowerCase());
          if (
            extName &&
            rosterMember &&
            childAllowsExternalFamilyEscort(rosterMember)
          ) {
            fields[ledsagerField] = formatExternalEscortLabel(extName);
          } else {
            fields[ledsagerField] = "";
          }
        }

        if (Object.keys(fields).length > 0) {
          await updateAirtableRecord(tableId, recordId, fields);
          updatedCount += 1;
        }
      }

      if (updatedCount === 0) {
        return NextResponse.json(
          { error: "Kunne ikke gemme workshopvalg — kontakt kursuslederen." },
          { status: 500 }
        );
      }

      const familyMemberCount = (await getFamilyMembersByLogin(login)).length;
      const registrationComplete = await hasWorkshopRegistration(login, year);
      if (registrationComplete) {
        await markBrugerWorkshopsTilmeldt(login);
      }

      return NextResponse.json({
        ok: true,
        saved: registrationComplete,
        registrationComplete,
        kursusYear: year,
        updatedCount,
        familyMemberCount,
        skipped: Array.from(skippedByConflict),
      });
    }

    const { navn, alder } = body as {
      navn: string;
      alder?: string | number;
    };

    const fornavn = navn?.trim();
    if (!fornavn) {
      return NextResponse.json({ error: "Fornavn mangler" }, { status: 400 });
    }

    const alderRaw = alder === undefined || alder === null ? "" : String(alder).trim();
    if (!alderRaw) {
      return NextResponse.json({ error: "Alder mangler" }, { status: 400 });
    }
    const alderNum = parseInt(alderRaw.replace(",", "."), 10);
    if (!Number.isFinite(alderNum) || alderNum < 0 || alderNum > 120) {
      return NextResponse.json({ error: "Angiv en gyldig alder" }, { status: 400 });
    }

    const type = alderNum >= 18 ? "Voksen" : "Barn";
    const fieldResolvers = await getParticipantFieldResolvers(tableId);

    const existingIds = await listParticipantRecordIdsForName(login, fornavn);
    if (existingIds.length > 0) {
      const primaryId = existingIds[0];
      await updateAirtableRecord(tableId, primaryId, {
        [fieldResolvers.navn]: fornavn,
        [fieldResolvers.alder]: alderNum,
        [fieldResolvers.barnVoksen]: type,
        [fieldResolvers.brugernavn]: login,
        [fieldResolvers.email]: login,
        [fieldResolvers.familie]: login,
      });
      for (let i = 1; i < existingIds.length; i++) {
        await deleteAirtableRecord(tableId, existingIds[i]);
      }
      return NextResponse.json({
        ok: true,
        updated: true,
        message: `${fornavn} findes allerede — alder er opdateret.`,
        member: rosterMemberPayload(fornavn, alderNum, type),
      });
    }

    const fields: Record<string, string | number> = {
      [fieldResolvers.brugernavn]: login,
      [fieldResolvers.email]: login,
      [fieldResolvers.familie]: login,
      [fieldResolvers.navn]: fornavn,
      [fieldResolvers.alder]: alderNum,
      [fieldResolvers.barnVoksen]: type,
    };

    await createAirtableRecord(tableId, fields);

    return NextResponse.json({
      ok: true,
      member: rosterMemberPayload(fornavn, alderNum, type),
    });
  } catch (error) {
    console.error("Workshop register API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
