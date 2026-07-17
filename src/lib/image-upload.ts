export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

const BLOCKED_VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "webm",
  "avi",
  "mkv",
  "m4v",
  "mpeg",
  "mpg",
  "3gp",
  "hevc",
  "wmv",
]);

export function validateBilleduploadFile(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (file.type.startsWith("video/")) {
    return "Videoer er ikke tilladt — upload kun billeder (JPG, PNG, WebP, GIF).";
  }

  if (BLOCKED_VIDEO_EXTENSIONS.has(ext)) {
    return "Videoer er ikke tilladt — upload kun billeder (JPG, PNG, WebP, GIF).";
  }

  if (ALLOWED_IMAGE_TYPES.has(file.type)) {
    return null;
  }

  if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return null;
  }

  return "Kun JPG, PNG, WebP og GIF er tilladt.";
}

export async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES || !file.type.startsWith("image/")) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxSide = 2200;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(
            new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Kunne ikke behandle billedet"));
    };
    img.src = url;
  });
}

export function formatUploadBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleString("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
