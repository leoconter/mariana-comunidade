export type MediaKind = "video" | "pdf" | "image" | "doc" | "sheet" | "other";

export function kindFromMime(mime: string): MediaKind {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (
    mime === "application/msword" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "doc";
  if (
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return "sheet";
  return "other";
}

export const KIND_LABELS: Record<MediaKind, string> = {
  video: "Vídeo",
  pdf: "PDF",
  image: "Imagem",
  doc: "Documento",
  sheet: "Planilha",
  other: "Arquivo",
};

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
