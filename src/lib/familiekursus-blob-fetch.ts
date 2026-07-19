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
  urlOrPathname: string
): Promise<GetBlobResult | null> {
  const options = blobStoreOptions();

  if (urlOrPathname.startsWith("http://") || urlOrPathname.startsWith("https://")) {
    const access = accessFromBlobUrl(urlOrPathname);
    return get(urlOrPathname, { access, ...options });
  }

  const attempts: Array<"private" | "public"> = ["private", "public"];
  for (const access of attempts) {
    try {
      const result = await get(urlOrPathname, { access, ...options });
      if (result && result.statusCode === 200 && result.stream) {
        return result;
      }
    } catch {
      // Prøv næste access-type (fx ældre uploads).
    }
  }

  return null;
}
