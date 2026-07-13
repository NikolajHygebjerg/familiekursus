import {
  CAST_MESSAGE_NAMESPACE,
  getCastDisplayUrl,
  getCastReceiverAppId,
  isIosDevice,
} from "./config";

let castInitialized = false;

export function initCastSender(): boolean {
  const appId = getCastReceiverAppId();
  if (!appId || castInitialized || typeof window === "undefined" || !window.cast?.framework) {
    return false;
  }

  window.cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId: appId,
    autoJoinPolicy: "origin_scoped",
  });
  castInitialized = true;
  return true;
}

export function isCastSdkAvailable(): boolean {
  return Boolean(getCastReceiverAppId() && window.cast?.framework);
}

export async function castSongViaSdk(songId: string): Promise<boolean> {
  if (!isCastSdkAvailable()) return false;

  const context = window.cast!.framework.CastContext.getInstance();
  let session = context.getCurrentSession();

  if (!session) {
    await context.requestSession();
    session = context.getCurrentSession();
  }

  if (!session) return false;

  await session.sendMessage(CAST_MESSAGE_NAMESPACE, { id: songId });
  return true;
}

export async function castSongViaPresentation(songId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("PresentationRequest" in window)) {
    return false;
  }

  const displayUrl = getCastDisplayUrl(songId);
  const request = new PresentationRequest([displayUrl]);
  await request.start();
  return true;
}

export async function castSong(songId: string): Promise<"sdk" | "presentation" | "failed"> {
  try {
    if (await castSongViaSdk(songId)) return "sdk";
  } catch {
    // Fall back to Presentation API below.
  }

  try {
    if (await castSongViaPresentation(songId)) return "presentation";
  } catch {
    return "failed";
  }

  return "failed";
}

export function supportsNativeCast(): boolean {
  if (typeof window === "undefined") return false;
  return isCastSdkAvailable() || "PresentationRequest" in window;
}

export function canCast(): boolean {
  return supportsNativeCast();
}

export function openTvDisplay(songId: string): void {
  window.open(getCastDisplayUrl(songId), "_blank", "noopener,noreferrer");
}

export async function copyTvDisplayLink(songId: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(getCastDisplayUrl(songId));
    return true;
  } catch {
    return false;
  }
}

export async function shareTvDisplay(songId: string, title: string): Promise<boolean> {
  const url = getCastDisplayUrl(songId);
  if (navigator.share) {
    try {
      await navigator.share({ title, text: `Sang: ${title}`, url });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return true;
      }
    }
  }
  return copyTvDisplayLink(songId);
}

export function shouldUseTvFallback(): boolean {
  return isIosDevice() || !supportsNativeCast();
}
