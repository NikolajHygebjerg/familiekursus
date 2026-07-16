import {
  getWorkshopCounts,
  getWorkshopParticipantsGrouped,
  getWorkshopBackendInfo,
  getBrugerByEmail,
  getAdminWorkshopRoles,
  getAftengrupperOptionsDetailed,
  getAftengruppeParticipantsGrouped,
  getActivityCount,
  getActivityParticipantsGrouped,
  type ActivityFieldKey,
} from "@/lib/airtable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID_WORKSHOPS = [
  "workshop1",
  "workshop2",
  "workshop3",
  "workshop4",
  "voksen",
  "aftengrupper",
  "gyserløb",
  "sheltertur",
] as const;
type WorkshopKey = (typeof VALID_WORKSHOPS)[number];

const ACTIVITY_OPTION_FIELDS: Record<string, ActivityFieldKey> = {
  Gyserløb: "gyserløb",
  "Uden overnatning": "sheltertur",
  "Med overnatning": "sheltertur_med_overnatning",
};

function isValidWorkshop(workshop: string | null): workshop is WorkshopKey {
  return !!workshop && VALID_WORKSHOPS.includes(workshop as WorkshopKey);
}

function resolveActivityField(workshop: "gyserløb" | "sheltertur", option: string): ActivityFieldKey | null {
  if (workshop === "gyserløb") {
    return option === "Gyserløb" ? "gyserløb" : null;
  }
  return ACTIVITY_OPTION_FIELDS[option] ?? null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workshop = searchParams.get("workshop");
    const option = searchParams.get("option")?.trim();
    const adminEmail = searchParams.get("email")?.trim().toLowerCase();

    if (!isValidWorkshop(workshop)) {
      return NextResponse.json(
        {
          error:
            "Ugyldig workshop. Brug: workshop1, workshop2, workshop3, workshop4, voksen, aftengrupper, gyserløb eller sheltertur",
        },
        { status: 400 }
      );
    }

    if (option) {
      if (!adminEmail) {
        return NextResponse.json({ error: "Email mangler" }, { status: 400 });
      }
      const bruger = await getBrugerByEmail(adminEmail);
      if (!bruger?.isAdmin) {
        return NextResponse.json({ error: "Kun administratorer har adgang" }, { status: 403 });
      }

      if (workshop === "aftengrupper") {
        const families = await getAftengruppeParticipantsGrouped(option);
        return NextResponse.json({ option, families, backend: null, roles: [] });
      }

      if (workshop === "gyserløb" || workshop === "sheltertur") {
        const fieldKey = resolveActivityField(workshop, option);
        if (!fieldKey) {
          return NextResponse.json({ error: "Ugyldig aktivitet" }, { status: 400 });
        }
        const families = await getActivityParticipantsGrouped(fieldKey);
        return NextResponse.json({ option, families, backend: null, roles: [] });
      }

      const [families, backend] = await Promise.all([
        getWorkshopParticipantsGrouped(workshop, option),
        getWorkshopBackendInfo(option),
      ]);
      const roles =
        backend && bruger.adminNavn ? getAdminWorkshopRoles(backend, bruger.adminNavn) : [];
      return NextResponse.json({ option, families, backend, roles });
    }

    if (workshop === "aftengrupper") {
      const options = await getAftengrupperOptionsDetailed();
      return NextResponse.json(
        options.map((option) => ({ name: option.name, count: option.current }))
      );
    }

    if (workshop === "gyserløb") {
      const count = await getActivityCount("gyserløb");
      return NextResponse.json([{ name: "Gyserløb", count }]);
    }

    if (workshop === "sheltertur") {
      const [udenCount, medCount] = await Promise.all([
        getActivityCount("sheltertur"),
        getActivityCount("sheltertur_med_overnatning"),
      ]);
      return NextResponse.json([
        { name: "Uden overnatning", count: udenCount },
        { name: "Med overnatning", count: medCount },
      ]);
    }

    const counts = await getWorkshopCounts(workshop);
    return NextResponse.json(counts);
  } catch (error) {
    console.error("Workshop API fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
