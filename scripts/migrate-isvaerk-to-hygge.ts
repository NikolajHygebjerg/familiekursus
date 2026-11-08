/**
 * Engangsmigrering: is@Isvaerk.dk → Hygge, fjern e-mail fra login-felter.
 * Kør: set -a && source .env.local && set +a && npx tsx scripts/migrate-isvaerk-to-hygge.ts
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import { deleteFkRecord, updateFkRecord } from "../src/lib/fk-records";

const OLD_LOGIN = "is@isvaerk.dk";
const NEW_LOGIN = "Hygge";
const ISVAERK_BRUGER_ID = "effb6714-6427-4f82-a57d-5529e4dbe352";
const HYGGE_BRUGER_ID = "e7ddb33b-9a4e-476f-992b-0ab48ec1c811";

function loginIsIsvaerk(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.trim().toLowerCase() === OLD_LOGIN;
}

function stripEmailFields(fields: Record<string, unknown>): Record<string, unknown> {
  const next = { ...fields };
  for (const key of ["Email", "email", "A Email"]) {
    delete next[key];
  }
  return next;
}

async function main() {
  const sb = createAdminClient();
  const { data: participants, error } = await sb
    .from("fk_records")
    .select("id, fields")
    .eq("table_key", "participants_2027");
  if (error) throw error;

  let updatedParticipants = 0;
  for (const row of participants ?? []) {
    const f = row.fields as Record<string, unknown>;
    const matches =
      loginIsIsvaerk(f.Brugernavn) ||
      loginIsIsvaerk(f.Familie) ||
      loginIsIsvaerk(f.Email) ||
      loginIsIsvaerk(f.email);
    if (!matches) continue;

    const merged = stripEmailFields({
      ...f,
      Brugernavn: NEW_LOGIN,
      Familie: NEW_LOGIN,
    });
    const { error: upErr } = await sb
      .from("fk_records")
      .update({ fields: merged })
      .eq("id", row.id)
      .eq("table_key", "participants_2027");
    if (upErr) throw upErr;
    updatedParticipants += 1;
  }

  await updateFkRecord("Brugere", HYGGE_BRUGER_ID, {
    WorkshopTilmeldt: "Ja",
    Brugernavn: NEW_LOGIN,
  });
  const { data: hyggeRow } = await sb
    .from("fk_records")
    .select("fields")
    .eq("id", HYGGE_BRUGER_ID)
    .maybeSingle();
  if (hyggeRow?.fields) {
    const cleaned = stripEmailFields(hyggeRow.fields as Record<string, unknown>);
    await sb.from("fk_records").update({ fields: cleaned }).eq("id", HYGGE_BRUGER_ID);
  }

  await deleteFkRecord("Brugere", ISVAERK_BRUGER_ID);

  console.log(`Opdateret ${updatedParticipants} deltager-rækker til ${NEW_LOGIN}.`);
  console.log("Slettet dublet-bruger is@Isvaerk.dk. Hygge markeret WorkshopTilmeldt.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
