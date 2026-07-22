import { ICLOUD_PHOTOS_PROMO, isIcloudPhotosPromoVisible } from "@/lib/billedupload-promo";

export function BilleduploadIcloudPromo() {
  if (!isIcloudPhotosPromoVisible()) {
    return null;
  }

  return (
    <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
      <p className="text-sm font-medium text-slate-800">Billeder fra familiekursus på iCloud</p>
      <p className="mt-1 text-sm text-slate-600">
        I kan også se og hente billeder via Apple iCloud-albummet herunder.
      </p>
      <a
        href={ICLOUD_PHOTOS_PROMO.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
      >
        Åbn billeder i iCloud
      </a>
    </div>
  );
}
