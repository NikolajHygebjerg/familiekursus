export function isBlobUploadConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export function moedOsImageProxyUrl(pathname: string): string {
  return `/api/moed-os/image?pathname=${encodeURIComponent(pathname)}`;
}
