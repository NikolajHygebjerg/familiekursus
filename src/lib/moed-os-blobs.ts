import { list } from "@vercel/blob";
import { blobStoreOptions, moedOsImageProxyUrl } from "@/lib/blob-config";
import type { MoedOsPersonView } from "@/lib/moed-os";

const BLOB_PATH_PATTERN = /^moed-os\/(.+)-(\d+)\.([a-z0-9]+)$/i;

export async function getLatestMoedOsBlobPathBySlug(): Promise<Map<string, string>> {
  const latestBySlug = new Map<string, { pathname: string; uploadedAt: number }>();

  try {
    let cursor: string | undefined;
    do {
      const result = await list({ prefix: "moed-os/", cursor, limit: 1000, ...blobStoreOptions() });
      for (const blob of result.blobs) {
        const match = blob.pathname.match(BLOB_PATH_PATTERN);
        if (!match) continue;

        const slug = match[1].toLowerCase();
        const uploadedAt = blob.uploadedAt?.getTime() ?? parseInt(match[2], 10);
        const current = latestBySlug.get(slug);
        if (!current || uploadedAt > current.uploadedAt) {
          latestBySlug.set(slug, { pathname: blob.pathname, uploadedAt });
        }
      }
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("Kunne ikke liste Mød os-billeder fra Blob:", error);
  }

  const pathBySlug = new Map<string, string>();
  latestBySlug.forEach(({ pathname }, slug) => {
    pathBySlug.set(slug, pathname);
  });
  return pathBySlug;
}

export function applyMoedOsBlobImages(
  people: MoedOsPersonView[],
  blobPathBySlug: Map<string, string>
): MoedOsPersonView[] {
  return people.map((person) => {
    const pathname = blobPathBySlug.get(person.slug);
    if (!pathname) return person;

    const match = pathname.match(BLOB_PATH_PATTERN);
    const cacheKey = match?.[2] ?? "1";
    return {
      ...person,
      image: `${moedOsImageProxyUrl(pathname)}&v=${cacheKey}`,
    };
  });
}
