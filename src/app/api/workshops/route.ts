import {
  getWorkshopCounts,
  getWorkshopParticipantsGrouped,
  getWorkshopBackendInfo,
  getBrugerByEmail,
  getAdminWorkshopRoles,
  getAftengrupperOptionsDetailed,
  getAftengruppeParticipantsGrouped,
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
] as const;
type WorkshopKey = (typeof VALID_WORKSHOPS)[number];

function isValidWorkshop(workshop: string | null): workshop is WorkshopKey {
  return !!workshop && VALID_WORKSHOPS.includes(workshop as WorkshopKey);
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
            "Ugyldig workshop. Brug: workshop1, workshop2, workshop3, workshop4, voksen eller aftengrupper",
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
