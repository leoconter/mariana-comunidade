"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Film, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Tables } from "@/lib/database.types";
import { attachRecording, cancelEvent } from "../actions";
import { EventDialog } from "../event-dialog";

type VideoOption = { id: string; title: string; duration_seconds: number | null };

export function EventAdminActions({
  event,
  spaces,
  videos,
}: {
  event: Tables<"events">;
  spaces: { id: string; name: string; emoji: string | null }[];
  videos: VideoOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [recordingOpen, setRecordingOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="size-4" /> Editar
      </Button>
      {!event.recording_post_id && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRecordingOpen(true)}
        >
          <Film className="size-4" /> Anexar gravação
        </Button>
      )}
      {!event.canceled_at && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await cancelEvent(event.id);
              toast.success("Evento cancelado.");
              router.refresh();
            })
          }
        >
          <Ban className="size-4" /> Cancelar evento
        </Button>
      )}

      <EventDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        spaces={spaces}
        event={event}
      />

      <Dialog open={recordingOpen} onOpenChange={setRecordingOpen}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anexar gravação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Escolha o vídeo (já processado) — um post com a gravação será criado
            no espaço do evento e vinculado ao arquivo de encontros.
          </p>
          {videos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum vídeo pronto na biblioteca. Envie a gravação em Mídia
              primeiro.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {videos.map((video) => (
                <li key={video.id}>
                  <button
                    disabled={pending}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await attachRecording(event.id, video.id);
                        if (result.ok) {
                          toast.success("Gravação anexada e publicada.");
                          setRecordingOpen(false);
                          router.refresh();
                        } else {
                          toast.error(result.message);
                        }
                      })
                    }
                  >
                    <Film className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{video.title}</span>
                    {video.duration_seconds && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(video.duration_seconds / 60)} min
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
