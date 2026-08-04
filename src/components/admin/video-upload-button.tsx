"use client";

import { useRef, useState } from "react";
import * as tus from "tus-js-client";
import { Film, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createVideoUpload,
  markVideoUploaded,
} from "@/app/(admin)/admin/midia/video-actions";

const TUS_ENDPOINT = "https://video.bunnycdn.com/tusupload";

export function VideoUploadButton({
  label = "Enviar vídeo",
  onUploaded,
}: {
  label?: string;
  onUploaded?: (mediaId: string) => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const title = file.name.replace(/\.[^.]+$/, "");

    const ticket = await createVideoUpload(title, file.name, file.size);
    if (!ticket.ok || !ticket.mediaId || !ticket.videoId) {
      toast.error(ticket.message ?? "Não foi possível iniciar o upload.");
      return;
    }

    setProgress(0);
    const upload = new tus.Upload(file, {
      endpoint: TUS_ENDPOINT,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      headers: {
        AuthorizationSignature: ticket.signature!,
        AuthorizationExpire: String(ticket.expiration!),
        VideoId: ticket.videoId,
        LibraryId: ticket.libraryId!,
      },
      metadata: { filetype: file.type, title },
      onProgress: (uploaded, total) => {
        setProgress(Math.round((uploaded / total) * 100));
      },
      onError: () => {
        setProgress(null);
        toast.error(
          "Falha no upload do vídeo. Selecione o mesmo arquivo para retomar de onde parou."
        );
      },
      onSuccess: async () => {
        setProgress(null);
        await markVideoUploaded(ticket.mediaId!);
        toast.success(
          "Vídeo enviado! O Bunny está processando — em alguns minutos ele fica pronto."
        );
        await onUploaded?.(ticket.mediaId!);
      },
    });

    // Resume a previous interrupted upload of the same file when possible.
    const previous = await upload.findPreviousUploads();
    if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
    upload.start();
  }

  const uploading = progress !== null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Film className="size-4" />
        )}
        {uploading ? `Enviando... ${progress}%` : label}
      </Button>
      {uploading && (
        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </>
  );
}
