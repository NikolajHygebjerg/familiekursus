export function isBlobUploadConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export function getPublicSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://familiekursus.vercel.app";
}

export function moedOsImageProxyUrl(pathname: string): string {
  return `/api/moed-os/image?pathname=${encodeURIComponent(pathname)}`;
}

export function blobStoreOptions(): { storeId?: string; token?: string } {
  const options: { storeId?: string; token?: string } = {};
  if (process.env.BLOB_STORE_ID) options.storeId = process.env.BLOB_STORE_ID;
  if (process.env.BLOB_READ_WRITE_TOKEN) options.token = process.env.BLOB_READ_WRITE_TOKEN;
  return options;
}

export function normalizeMoedOsStoredImage(stored: string | null | undefined): string {
  if (!stored?.trim()) return "";
  const value = stored.trim();

  if (/^moed-os\/[^\s?#]+$/i.test(value)) {
    const cacheKey = value.match(/-(\d+)\./)?.[1] ?? "1";
    return `${moedOsImageProxyUrl(value)}&v=${cacheKey}`;
  }

  if (value.startsWith("/api/moed-os/image")) {
    return value.includes("&v=") || value.includes("?v=") ? value : `${value}&v=1`;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const pathname = url.searchParams.get("pathname");
      if (pathname?.startsWith("moed-os/")) {
        const cacheKey = pathname.match(/-(\d+)\./)?.[1] ?? "1";
        return `${moedOsImageProxyUrl(pathname)}&v=${cacheKey}`;
      }
    } catch {
      // ignore invalid URL
    }
    return value;
  }

  return value;
}

export function toAbsoluteMoedOsImageUrl(relativeOrAbsoluteUrl: string): string {
  const url = relativeOrAbsoluteUrl.trim();
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${getPublicSiteUrl()}${url}`;
  return url;
}
