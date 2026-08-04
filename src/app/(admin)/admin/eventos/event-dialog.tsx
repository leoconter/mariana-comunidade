"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/lib/database.types";
import { saveEvent, type EventFormResult } from "./actions";

type SpaceOption = { id: string; name: string; emoji: string | null };
type EventRow = Tables<"events">;

const initialState: EventFormResult = { ok: false };

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventDialog({
  open,
  onOpenChange,
  spaces,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaces: SpaceOption[];
  event: EventRow | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveEvent, initialState);

  useEffect(() => {
    if (state.ok) {
      toast.success(event ? "Evento atualizado." : "Evento criado.");
      onOpenChange(false);
      router.refresh();
    }
  }, [state, event, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={event?.id ?? ""} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-title">Título</Label>
            <Input
              id="event-title"
              name="title"
              required
              defaultValue={event?.title ?? "Round Clínico — Traga seu caso impossível"}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-starts">Data e hora (Brasília)</Label>
              <Input
                id="event-starts"
                name="starts_at"
                type="datetime-local"
                required
                defaultValue={
                  event?.starts_at ? toLocalInputValue(event.starts_at) : ""
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-duration">Duração (min)</Label>
              <Input
                id="event-duration"
                name="duration_minutes"
                type="number"
                min={15}
                step={15}
                defaultValue={event?.duration_minutes ?? 60}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Espaço</Label>
            <select
              name="space_id"
              required
              defaultValue={event?.space_id ?? spaces[0]?.id ?? ""}
              className="h-9 rounded-lg border bg-card px-3 text-sm"
            >
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.emoji} {space.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-url">Link da call (Zoom/Meet)</Label>
            <Input
              id="event-url"
              name="meeting_url"
              type="url"
              placeholder="https://meet.google.com/..."
              defaultValue={event?.meeting_url ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event-description">Descrição</Label>
            <Textarea
              id="event-description"
              name="description"
              rows={3}
              defaultValue={event?.description ?? ""}
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            Aceitar submissão de casos
            <Switch
              name="accepts_cases"
              defaultChecked={event?.accepts_cases ?? true}
            />
          </label>
          {!state.ok && state.message && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EventCreateButton({ spaces }: { spaces: SpaceOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Novo evento
      </Button>
      <EventDialog
        open={open}
        onOpenChange={setOpen}
        spaces={spaces}
        event={null}
      />
    </>
  );
}
