import { Download, FileSpreadsheet, FileText, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/database.types";
import { formatBytes, KIND_LABELS, type MediaKind } from "@/lib/media";
import { mediaSignedUrl } from "@/lib/storage";
import { VideoEmbed } from "./video-embed";

type Attachment = Tables<"post_attachments"> & {
  media_assets: Tables<"media_assets"> | null;
};

/** Video embeds — rendered above the post body (video-first content). */
export function PostVideos({
  attachments,
  videoStartSeconds,
}: {
  attachments: Attachment[];
  videoStartSeconds?: Record<string, number>;
}) {
  const videos = attachments.filter(
    (a) => a.media_assets && a.media_assets.kind === "video"
  );
  if (videos.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {videos.map((attachment) => (
        <VideoEmbed
          key={attachment.id}
          media={attachment.media_assets!}
          startAtSeconds={videoStartSeconds?.[attachment.media_id]}
        />
      ))}
    </div>
  );
}

export async function PostAttachments({
  attachments,
}: {
  attachments: Attachment[];
}) {
  const items = await Promise.all(
    attachments
      .filter((a) => a.media_assets && a.media_assets.kind !== "video")
      .map(async (attachment) => {
        const media = attachment.media_assets!;
        const [viewUrl, downloadUrl] = media.storage_path
          ? await Promise.all([
              mediaSignedUrl(media.storage_path),
              mediaSignedUrl(media.storage_path, 3600, media.filename),
            ])
          : [null, null];
        return { attachment, media, viewUrl, downloadUrl };
      })
  );

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {items.map(({ attachment, media, viewUrl, downloadUrl }) => {
        if (media.kind === "image" && viewUrl) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={attachment.id}
              src={viewUrl}
              alt={attachment.caption ?? media.title}
              className="max-h-[70vh] w-auto rounded-xl border object-contain"
            />
          );
        }
        return (
          <div key={attachment.id} className="overflow-hidden rounded-xl border">
            <div className="flex items-center gap-3 bg-card px-4 py-3">
              {media.kind === "sheet" ? (
                <FileSpreadsheet className="size-5 shrink-0 text-primary" />
              ) : media.kind === "pdf" ? (
                <FileText className="size-5 shrink-0 text-primary" />
              ) : (
                <Paperclip className="size-5 shrink-0 text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{media.title}</p>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABELS[media.kind as MediaKind] ?? media.kind} ·{" "}
                  {formatBytes(media.size_bytes)}
                </p>
              </div>
              {downloadUrl && (
                <Button size="sm" variant="outline" asChild>
                  <a href={downloadUrl}>
                    <Download className="size-4" /> Baixar
                  </a>
                </Button>
              )}
            </div>
            {media.kind === "pdf" && viewUrl && (
              <iframe
                src={viewUrl}
                title={media.title}
                className="h-[60vh] w-full border-t bg-muted/30"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
