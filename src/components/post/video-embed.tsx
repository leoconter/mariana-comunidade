import { Clapperboard } from "lucide-react";
import { isBunnyConfigured, signedEmbedUrl } from "@/lib/bunny";
import type { Tables } from "@/lib/database.types";
import { VideoFrame } from "./video-frame";

export function VideoEmbed({
  media,
  startAtSeconds,
}: {
  media: Tables<"media_assets">;
  startAtSeconds?: number;
}) {
  if (!media.bunny_video_id || !isBunnyConfigured()) return null;

  if (media.bunny_status !== "ready") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted/40 text-center">
        <Clapperboard className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {media.bunny_status === "failed"
            ? "Falha no processamento deste vídeo."
            : "Vídeo em processamento — volte em alguns minutos."}
        </p>
      </div>
    );
  }

  const src = signedEmbedUrl(media.bunny_video_id, { startAtSeconds });
  return (
    <div className="overflow-hidden rounded-xl border">
      <VideoFrame src={src} title={media.title} mediaId={media.id} />
    </div>
  );
}
