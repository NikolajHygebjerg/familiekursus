import { get, type GetBlobResult } from "@vercel/blob";
import { blobStoreOptions } from "@/lib/blob-config";

const BLOB_HOST = ".blob.vercel-storage.com";

export function isFamiliekursusBlobUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return (
      hostname.endsWith(BLOB_HOST) &&
      pathname.startsWith("/familiekursus-billeder/")
    );
  } catch {
    return false;
  }
}

function accessFromBlobUrl(url: string): "public" | "private" {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes(".public.")) return "public";
  } catch {
    // fall through
  }
  return "private";
}

export async function fetchFamiliekursusBlob(
  urlOrPathname: string,
  pathnameFallback?: string
): Promise<GetBlobResult | null> {
  const options = blobStoreOptions();
  const candidates = [
    urlOrPathname,
    pathnameFallback && pathnameFallback !== urlOrPathname ? pathnameFallback : null,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      const access = accessFromBlobUrl(candidate);
      try {
        const result = await get(candidate, { access, ...options });
        if (result && result.statusCode === 200 && result.stream) {
          return result;
        }
      } catch {
        // Prøv pathname-fallback næste.
      }
      continue;
    }

    for (const access of ["private", "public"] as const) {
      try {
        const result = await get(candidate, { access, ...options });
        if (result && result.statusCode === 200 && result.stream) {
          return result;
        }
      } catch {
        // Prøv næste access-type.
      }
    }
  }

  return null;
}
