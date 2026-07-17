"use client";

/** iOS/Safari bliver upålidelig ved mange filer ad gangen — anbefalet batch-størrelse. */
export const RECOMMENDED_UPLOAD_BATCH = 20;

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function mergeSelectedFiles(existing: File[], picked: File[]): File[] {
  if (picked.length === 0) return existing;
  const seen = new Set(existing.map(fileKey));
  const merged = [...existing];
  for (const file of picked) {
    const key = fileKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(file);
  }
  return merged;
}

interface BilleduploadFilePickerProps {
  id: string;
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  helperText?: string;
}

export function BilleduploadFilePicker({
  id,
  files,
  onChange,
  disabled = false,
  helperText = "Kun billeder (JPG, PNG, WebP, GIF). Videoer accepteres ikke. Max 4,5 MB pr. billede.",
}: BilleduploadFilePickerProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        Vælg billeder
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        disabled={disabled}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (picked.length === 0) return;
          onChange(mergeSelectedFiles(files, picked));
        }}
        className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-amber-800 hover:file:bg-amber-200 disabled:opacity-50"
      />

      {files.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            {files.length} {files.length === 1 ? "billede valgt" : "billeder valgt"}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className="text-sm text-slate-500 underline hover:text-slate-700 disabled:opacity-50"
          >
            Ryd valg
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Ingen billeder valgt endnu.</p>
      )}

      <p className="mt-2 text-xs text-slate-500">
        {helperText} På iPhone: vælg gerne højst {RECOMMENDED_UPLOAD_BATCH} ad gangen — du kan
        tilføje flere omgange.
      </p>

      {files.length > RECOMMENDED_UPLOAD_BATCH && (
        <p className="mt-2 text-xs text-amber-700">
          Du har valgt {files.length} billeder. Det kan tage lidt tid at uploade — eller upload i
          mindre portioner, hvis det fejler.
        </p>
      )}
    </div>
  );
}
