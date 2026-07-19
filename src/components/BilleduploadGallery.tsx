import { familiekursusBilledeUrl } from "@/lib/blob-config";
import { formatUploadBytes, formatUploadDate } from "@/lib/image-upload";

export interface BilleduploadGalleryFile {
  pathname: string;
  url?: string;
  filename: string;
  uploadedAt: string;
  size: number;
}

export interface BilleduploadGalleryGroup {
  email: string;
  familie: string | null;
  files: BilleduploadGalleryFile[];
}

interface BilleduploadGalleryProps {
  files: BilleduploadGalleryFile[];
  viewerEmail: string;
  title?: string;
  emptyMessage?: string;
}

function GalleryGrid({
  files,
  viewerEmail,
}: {
  files: BilleduploadGalleryFile[];
  viewerEmail: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {files.map((file) => (
        <div
          key={file.pathname}
          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        >
          <a
                href={familiekursusBilledeUrl(file.pathname, viewerEmail, false, file.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-square bg-slate-200"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                  src={familiekursusBilledeUrl(file.pathname, viewerEmail, false, file.url)}
              alt={file.filename}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </a>
          <div className="space-y-2 p-2">
            <p className="truncate text-xs text-slate-600" title={file.filename}>
              {file.filename}
            </p>
            <p className="text-xs text-slate-400">
              {formatUploadDate(file.uploadedAt)} · {formatUploadBytes(file.size)}
            </p>
            <a
                  href={familiekursusBilledeUrl(file.pathname, viewerEmail, true, file.url)}
              className="inline-block text-xs font-medium text-amber-700 hover:underline"
            >
              Download
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BilleduploadGallery({
  files,
  viewerEmail,
  title = "Uploadede billeder",
  emptyMessage = "Ingen billeder uploadet endnu.",
}: BilleduploadGalleryProps) {
  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {files.length > 0 && (
          <p className="text-sm text-slate-500">
            {files.length} {files.length === 1 ? "billede" : "billeder"}
          </p>
        )}
      </div>

      {files.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <GalleryGrid files={files} viewerEmail={viewerEmail} />
      )}
    </section>
  );
}

interface BilleduploadGalleryGroupsProps {
  groups: BilleduploadGalleryGroup[];
  viewerEmail: string;
  title?: string;
  emptyMessage?: string;
}

export function BilleduploadGalleryGroups({
  groups,
  viewerEmail,
  title = "Alle uploadede billeder",
  emptyMessage = "Ingen billeder uploadet endnu.",
}: BilleduploadGalleryGroupsProps) {
  const totalImages = groups.reduce((sum, group) => sum + group.files.length, 0);

  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {totalImages > 0 && (
          <p className="text-sm text-slate-500">
            {totalImages} {totalImages === 1 ? "billede" : "billeder"} fra {groups.length}{" "}
            {groups.length === 1 ? "familie" : "familier"}
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.email}>
              <div className="mb-3">
                <h4 className="font-medium text-slate-800">{group.familie || group.email}</h4>
                <p className="text-xs text-slate-500">
                  {group.files.length} {group.files.length === 1 ? "billede" : "billeder"}
                </p>
              </div>
              <GalleryGrid files={group.files} viewerEmail={viewerEmail} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
