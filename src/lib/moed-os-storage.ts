import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";

export const MOED_OS_BUCKET = "moed-os";

export function isMoedOsStorageConfigured(): boolean {
  return isSupabaseConfigured();
}

/** Objektsti i bucket (uden bucket-navn). */
export function moedOsStorageObjectKey(pathname: string): string {
  const trimmed = pathname.trim().replace(/^\/+/, "");
  return trimmed.startsWith(`${MOED_OS_BUCKET}/`)
    ? trimmed.slice(MOED_OS_BUCKET.length + 1)
    : trimmed;
}

export async function uploadMoedOsImage(pathname: string, data: Blob, contentType: string) {
  const supabase = createAdminClient();
  const key = moedOsStorageObjectKey(pathname);
  const { error } = await supabase.storage.from(MOED_OS_BUCKET).upload(key, data, {
    upsert: true,
    contentType,
  });
  if (error) throw new Error(error.message);
}

export async function downloadMoedOsImage(pathname: string): Promise<{ data: Blob; contentType: string } | null> {
  const supabase = createAdminClient();
  const key = moedOsStorageObjectKey(pathname);
  const { data, error } = await supabase.storage.from(MOED_OS_BUCKET).download(key);
  if (error || !data) return null;
  return { data, contentType: data.type || "image/jpeg" };
}

export async function listMoedOsImagePaths(): Promise<{ pathname: string; updatedAt: string | null }[]> {
  const supabase = createAdminClient();
  const out: { pathname: string; updatedAt: string | null }[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(MOED_OS_BUCKET).list(undefined, {
      limit,
      offset,
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (error) {
      console.error("Kunne ikke liste Mød os-billeder:", error.message);
      break;
    }
    if (!data?.length) break;
    for (const file of data) {
      if (!file.name || file.name.endsWith("/")) continue;
      out.push({
        pathname: `${MOED_OS_BUCKET}/${file.name}`,
        updatedAt: file.updated_at ?? null,
      });
    }
    if (data.length < limit) break;
    offset += limit;
  }

  return out;
}
