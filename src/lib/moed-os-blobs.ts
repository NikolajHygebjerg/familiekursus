import { moedOsImageProxyUrl } from "@/lib/blob-config";
import { listMoedOsImagePaths } from "@/lib/moed-os-storage";
import type { MoedOsPersonView } from "@/lib/moed-os";

const BLOB_PATH_PATTERN = /^moed-os\/(.+)-(\d+)\.([a-z0-9]+)$/i;

export async function getLatestMoedOsBlobPathBySlug(): Promise<Map<string, string>> {
  const latestBySlug = new Map<string, { pathname: string; uploadedAt: number }>();

  const files = await listMoedOsImagePaths();
  for (const file of files) {
    const match = file.pathname.match(BLOB_PATH_PATTERN);
    if (!match) continue;

    const slug = match[1].toLowerCase();
    const uploadedAt = file.updatedAt
      ? new Date(file.updatedAt).getTime()
      : parseInt(match[2], 10);
    const current = latestBySlug.get(slug);
    if (!current || uploadedAt > current.uploadedAt) {
      latestBySlug.set(slug, { pathname: file.pathname, uploadedAt });
    }
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
