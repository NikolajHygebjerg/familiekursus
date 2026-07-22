/** iCloud-album — vises på billedupload indtil denne dato (inkl.). */
export const ICLOUD_PHOTOS_PROMO = {
  url: "https://share.icloud.com/photos/093R6f0xVZqABK-7ru3-flPaw",
  /** Sidste dag linket vises (30 dage fra 21. jul. 2026). */
  visibleUntil: "2026-08-20",
} as const;

export function isIcloudPhotosPromoVisible(now = new Date()): boolean {
  const end = new Date(`${ICLOUD_PHOTOS_PROMO.visibleUntil}T23:59:59`);
  return now.getTime() <= end.getTime();
}
