import { createAdminClient } from "@/lib/supabase/admin";

const SETTINGS_TABLE_KEY = "moed_os_settings";
const SETTINGS_RECORD_ID = "00000000-0000-4000-8000-000000000001";

export async function getMoedOsVisibleToKursister(): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fk_records")
    .select("fields")
    .eq("id", SETTINGS_RECORD_ID)
    .eq("table_key", SETTINGS_TABLE_KEY)
    .maybeSingle();

  if (error || !data?.fields) return false;

  const fields = data.fields as Record<string, unknown>;
  return fields.visibleToKursister === true || fields.visibleToKursister === "Ja";
}

export async function setMoedOsVisibleToKursister(visible: boolean): Promise<void> {
  const supabase = createAdminClient();
  const fields = { visibleToKursister: visible };

  const { data: existing } = await supabase
    .from("fk_records")
    .select("id")
    .eq("id", SETTINGS_RECORD_ID)
    .eq("table_key", SETTINGS_TABLE_KEY)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("fk_records")
      .update({ fields })
      .eq("id", SETTINGS_RECORD_ID)
      .eq("table_key", SETTINGS_TABLE_KEY);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("fk_records").insert({
    id: SETTINGS_RECORD_ID,
    table_key: SETTINGS_TABLE_KEY,
    fields,
  });
  if (error) throw new Error(error.message);
}
