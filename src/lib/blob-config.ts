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

export function toAbsoluteMoedOsImageUrl(relativeOrAbsoluteUrl: string): string {
  const url = relativeOrAbsoluteUrl.trim();
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${getPublicSiteUrl()}${url}`;
  return url;
}
