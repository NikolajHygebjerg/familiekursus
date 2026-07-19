import { list } from "@vercel/blob";
import { blobStoreOptions } from "@/lib/blob-config";

const BILLEUPLOAD_PREFIX = "familiekursus-billeder/";

export interface FamiliekursusBillede {
  pathname: string;
  url: string;
  filename: string;
  email: string;
  uploadedAt: string;
  size: number;
}

export interface FamiliekursusBilledeGroup {
  email: string;
  files: FamiliekursusBillede[];
}

function parseBillede(blob: {
  pathname: string;
  url?: string;
  uploadedAt?: Date;
  size: number;
}): FamiliekursusBillede | null {
  if (!blob.pathname.startsWith(BILLEUPLOAD_PREFIX)) return null;
  const rest = blob.pathname.slice(BILLEUPLOAD_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return null;

  const email = rest.slice(0, slash);
  const filename = rest.slice(slash + 1);
  if (!email || !filename) return null;

  return {
    pathname: blob.pathname,
    url: blob.url || "",
    filename,
    email,
    uploadedAt: (blob.uploadedAt ?? new Date()).toISOString(),
    size: blob.size,
  };
}

export async function listFamiliekursusBilleder(): Promise<{
  groups: FamiliekursusBilledeGroup[];
  totalCount: number;
}> {
  const byEmail = new Map<string, FamiliekursusBillede[]>();

  try {
    let cursor: string | undefined;
    do {
      const result = await list({
        prefix: BILLEUPLOAD_PREFIX,
        cursor,
        limit: 1000,
        ...blobStoreOptions(),
      });

      for (const blob of result.blobs) {
        const parsed = parseBillede(blob);
        if (!parsed) continue;
        const files = byEmail.get(parsed.email) || [];
        files.push(parsed);
        byEmail.set(parsed.email, files);
      }

      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("Kunne ikke liste familiekursus-billeder:", error);
    throw error;
  }

  const groups = Array.from(byEmail.entries())
    .map(([email, files]) => ({
      email,
      files: files.sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      ),
    }))
    .sort((a, b) => a.email.localeCompare(b.email, "da"));

  const totalCount = groups.reduce((sum, group) => sum + group.files.length, 0);
  return { groups, totalCount };
}
