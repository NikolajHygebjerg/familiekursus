import {
  createAirtableRecord,
  deleteAirtableRecord,
  getParticipantRecordIdsByLogin,
  getYearTableId,
  hasWorkshopRegistration,
  listParticipantRecordIdsForName,
  normalizeLoginName,
  updateAirtableRecord,
  WORKSHOP_FIELDS,
  type WorkshopSlotKey,
} from "@/lib/airtable";
import { validateWorkshopPicksForLogin } from "@/lib/workshop-capacity";
import { getKursusYear } from "@/lib/kursus-year";
import { NextResponse } from "next/server";

const NAVN_FIELDS = ["Navn", "navn", "Name", "name"];
const EMAIL_FIELDS = ["Email", "email", "A Email"];
const BRUGERNAVN_FIELDS = ["Brugernavn", "brugernavn", "Login", "login"];
const FAMILIE_FIELDS = ["Familie", "familie", "Family", "family"];
const ALDER_FIELDS = ["Alder", "A Alder", "#Alder", "alder", "Age", "age"];
const BARN_VOKSEN_FIELDS = ["Barn/voksen", "Barn/Voksen", "barn_voksen"];

function fieldName(key: WorkshopSlotKey): string {
  return WORKSHOP_FIELDS[key][0];
}

type MemberWorkshops = {
  navn: string;
  workshop1?: string;
  workshop2?: string;
  workshop3?: string;
  workshop4?: string;
  voksen?: string;
};

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

      for (const member of members) {
        const navn = member.navn?.trim();
        if (!navn) continue;
        const recordId = recordIds.get(navn.toLowerCase());
        if (!recordId) continue;

        const fields: Record<string, string> = {};
        const slots: WorkshopSlotKey[] = ["workshop1", "workshop2", "workshop3", "workshop4", "voksen"];
        for (const slot of slots) {
          const sk = `${navn.toLowerCase()}::${slot}`;
          if (skippedByConflict.has(sk)) {
            fields[fieldName(slot)] = "";
            continue;
          }
          const value = member[slot]?.trim();
          if (value) fields[fieldName(slot)] = value;
        }

        if (Object.keys(fields).length > 0) {
          await updateAirtableRecord(tableId, recordId, fields);
        }
      }

      return NextResponse.json({
        ok: true,
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

    const existingIds = await listParticipantRecordIdsForName(login, fornavn);
    if (existingIds.length > 0) {
      const primaryId = existingIds[0];
      await updateAirtableRecord(tableId, primaryId, {
        [NAVN_FIELDS[0]]: fornavn,
        [ALDER_FIELDS[0]]: alderNum,
        [BARN_VOKSEN_FIELDS[0]]: type,
        [BRUGERNAVN_FIELDS[0]]: login,
        [EMAIL_FIELDS[0]]: login,
        [FAMILIE_FIELDS[0]]: login,
      });
      for (let i = 1; i < existingIds.length; i++) {
        await deleteAirtableRecord(tableId, existingIds[i]);
      }
      return NextResponse.json({
        ok: true,
        updated: true,
        message: `${fornavn} findes allerede — alder er opdateret.`,
      });
    }

    const fields: Record<string, string | number> = {
      [BRUGERNAVN_FIELDS[0]]: login,
      [EMAIL_FIELDS[0]]: login,
      [FAMILIE_FIELDS[0]]: login,
      [NAVN_FIELDS[0]]: fornavn,
      [ALDER_FIELDS[0]]: alderNum,
      [BARN_VOKSEN_FIELDS[0]]: type,
    };

    await createAirtableRecord(tableId, fields);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Workshop register API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
