"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/lib/database.types";
import { saveSection, saveSpace, type SpaceFormResult } from "./actions";

type Section = Tables<"sections">;
type Space = Tables<"spaces">;

const initialState: SpaceFormResult = { ok: false };

export function SpaceDialog({
  open,
  space,
  sections,
  onOpenChange,
}: {
  open: boolean;
  space: Space | null;
  sections: Section[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveSpace, initialState);

  useEffect(() => {
    if (state.ok) {
      toast.success(space ? "Espaço atualizado." : "Espaço criado.");
      onOpenChange(false);
      router.refresh();
    }
  }, [state, space, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{space ? "Editar espaço" : "Novo espaço"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={space?.id ?? ""} />
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="space-emoji">Emoji</Label>
              <Input
                id="space-emoji"
                name="emoji"
                defaultValue={space?.emoji ?? ""}
                placeholder="🆕"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="space-name">Nome</Label>
              <Input
                id="space-name"
                name="name"
                defaultValue={space?.name ?? ""}
                placeholder="Conduta da Semana"
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-slug">
              Slug{" "}
              <span className="font-normal text-muted-foreground">
                (endereço — deixe em branco para gerar do nome)
              </span>
            </Label>
            <Input
              id="space-slug"
              name="slug"
              defaultValue={space?.slug ?? ""}
              placeholder="conduta-da-semana"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-description">Descrição</Label>
            <Textarea
              id="space-description"
              name="description"
              defaultValue={space?.description ?? ""}
              rows={2}
              placeholder="O que as membras encontram neste espaço?"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Select name="type" defaultValue={space?.type ?? "feed"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feed">
                    Feed — conteúdo cronológico
                  </SelectItem>
                  <SelectItem value="library">
                    Biblioteca — conteúdo perene
                  </SelectItem>
                  <SelectItem value="events">Eventos — calls ao vivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Seção</Label>
              <Select
                name="section_id"
                defaultValue={space?.section_id ?? undefined}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem seção" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Visibilidade</Label>
            <Select name="visibility" defaultValue={space?.visibility ?? "all"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  Visível para todas as membras
                </SelectItem>
                <SelectItem value="hidden">
                  Oculto — só administradoras veem
                </SelectItem>
                <SelectItem value="invite">Somente por convite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              Membras podem publicar posts
              <Switch
                name="allow_member_posts"
                defaultChecked={space?.allow_member_posts ?? false}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              Comentários habilitados
              <Switch
                name="allow_comments"
                defaultChecked={space?.allow_comments ?? true}
              />
            </label>
          </div>
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

export function SectionDialog({
  open,
  section,
  onOpenChange,
}: {
  open: boolean;
  section: Section | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveSection,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(section ? "Seção atualizada." : "Seção criada.");
      onOpenChange(false);
      router.refresh();
    }
  }, [state, section, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{section ? "Renomear seção" : "Nova seção"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={section?.id ?? ""} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="section-name">Nome</Label>
            <Input
              id="section-name"
              name="name"
              defaultValue={section?.name ?? ""}
              placeholder="Conteúdo Semanal"
              required
              autoFocus
            />
          </div>
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
