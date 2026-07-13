export const CAST_MESSAGE_NAMESPACE = "urn:x-cast:com.familiekursus.sange";

export function getCastReceiverAppId(): string | null {
  const appId = process.env.NEXT_PUBLIC_CAST_APP_ID?.trim();
  return appId || null;
}

export function getCastDisplayUrl(songId: string): string {
  if (typeof window === "undefined") {
    return `/cast/display.html?id=${encodeURIComponent(songId)}`;
  }
  const url = new URL("/cast/display.html", window.location.origin);
  url.searchParams.set("id", songId);
  return url.toString();
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
