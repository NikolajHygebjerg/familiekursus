import {
  getAdminBrugerOptions,
  getBrugerByEmail,
  getProgramAnsvarligeRecords,
  replaceProgramAnsvarligeRecords,
} from "@/lib/airtable";
import {
  buildProgramItemKey,
  groupAnsvarligeByKey,
  type ProgramAnsvarDraft,
} from "@/lib/program-ansvar";
import { isAppSuperAdmin } from "@/lib/super-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase() || null;

    if (!email) {
      return NextResponse.json({ error: "Email mangler" }, { status: 400 });
    }

    const bruger = await getBrugerByEmail(email);
    if (!bruger?.isAdmin) {
      return NextResponse.json({ error: "Kun administratorer har adgang" }, { status: 403 });
    }

    const ansvarlige = await getProgramAnsvarligeRecords();
    const byKey = groupAnsvarligeByKey(
      ansvarlige.map((entry) => ({
        id: entry.id,
        programKey: entry.programKey,
        adminEmail: entry.adminEmail,
        adminNavn: entry.adminNavn,
        note: entry.note,
        sortOrder: entry.sortOrder,
      }))
    );

    const isSuperAdmin = isAppSuperAdmin(email);

    return NextResponse.json({
      byKey,
      isSuperAdmin,
      adminNavn: bruger.adminNavn,
      adminUsers: isSuperAdmin ? await getAdminBrugerOptions() : [],
    });
  } catch (error) {
    console.error("Program ansvar GET fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const dag = body.dag?.trim();
    const tid = typeof body.tid === "string" ? body.tid.trim() : undefined;
    const titel = body.titel?.trim();
    const ansvarlige = Array.isArray(body.ansvarlige) ? (body.ansvarlige as ProgramAnsvarDraft[]) : [];

    if (!email || !dag || !titel) {
      return NextResponse.json({ error: "Email, dag og titel mangler" }, { status: 400 });
    }

    if (!isAppSuperAdmin(email)) {
      return NextResponse.json({ error: "Kun super-admin kan tildele ansvarlige" }, { status: 403 });
    }

    const programKey = buildProgramItemKey(dag, { tid, titel });
    const adminUsers = await getAdminBrugerOptions();
    const adminByEmail = new Map(adminUsers.map((admin) => [admin.email, admin.navn]));

    const cleaned = ansvarlige
      .map((entry) => {
        const adminEmail = entry.adminEmail?.trim().toLowerCase();
        if (!adminEmail) return null;
        const adminNavn = adminByEmail.get(adminEmail) || entry.adminNavn?.trim();
        if (!adminNavn) return null;
        return {
          adminEmail,
          adminNavn,
          note: typeof entry.note === "string" ? entry.note.trim() : "",
        };
      })
      .filter((entry): entry is { adminEmail: string; adminNavn: string; note: string } => !!entry);

    await replaceProgramAnsvarligeRecords(programKey, dag, tid, titel, cleaned);

    return NextResponse.json({ ok: true, programKey });
  } catch (error) {
    console.error("Program ansvar PUT fejl:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ukendt fejl" },
      { status: 500 }
    );
  }
}
