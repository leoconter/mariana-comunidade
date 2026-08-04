"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { JSONContent } from "@tiptap/react";
import { ArrowLeft, CalendarClock, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CustomFieldsForm } from "@/components/editor/custom-fields-form";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import type { Json, Tables } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";
import { parseFieldSchema } from "@/lib/post-fields";
import { EMPTY_DOC } from "@/lib/tiptap";
import {
  cancelSchedule,
  deletePost,
  duplicatePost,
  publishPost,
  savePost,
  schedulePost,
  unpublishPost,
} from "../actions";
import {
  AttachmentsPanel,
  type AttachmentWithMedia,
} from "./attachments-panel";

type Post = Tables<"posts"> & {
  post_types: {
    name: string;
    emoji: string | null;
    field_schema: Json;
  } | null;
  spaces: { slug: string } | null;
};
type SpaceOption = Pick<Tables<"spaces">, "id" | "name" | "emoji" | "slug">;

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado",
};

export function PostEditorForm({
  post,
  spaces,
  attachments,
  allTags,
  initialTagIds,
}: {
  post: Post;
  spaces: SpaceOption[];
  attachments: AttachmentWithMedia[];
  allTags: { id: string; name: string }[];
  initialTagIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState<JSONContent>(
    (post.body as JSONContent) ?? EMPTY_DOC
  );
  const [spaceId, setSpaceId] = useState(post.space_id);
  const [isPinned, setIsPinned] = useState(post.is_pinned);
  const [commentsClosed, setCommentsClosed] = useState(post.comments_closed);
  const [notifyMembers, setNotifyMembers] = useState(post.notify_members);
  const [customFields, setCustomFields] = useState<Record<string, string>>(
    (post.custom_fields as Record<string, string>) ?? {}
  );
  const [scheduleValue, setScheduleValue] = useState("");
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds);

  const fieldSchema = parseFieldSchema(post.post_types?.field_schema);

  const currentSpace = spaces.find((s) => s.id === spaceId);
  const memberUrl = currentSpace ? `/e/${currentSpace.slug}/p/${post.id}` : null;

  function save(afterSave?: () => Promise<void>, successMessage = "Post salvo.") {
    startTransition(async () => {
      try {
        await savePost({
          id: post.id,
          title,
          body: body as Json,
          spaceId,
          customFields: customFields as Json,
          tagIds,
          isPinned,
          commentsClosed,
          notifyMembers,
        });
        if (afterSave) await afterSave();
        toast.success(successMessage);
      } catch {
        toast.error("Não foi possível salvar. Tente novamente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/posts">
            <ArrowLeft className="size-4" /> Posts
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={post.status === "published" ? "default" : "outline"}>
            {STATUS_LABELS[post.status] ?? post.status}
          </Badge>
          {post.post_types && (
            <Badge variant="secondary">
              {post.post_types.emoji} {post.post_types.name}
            </Badge>
          )}
          {memberUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={memberUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                <span className="sr-only sm:not-sr-only">Ver como membra</span>
              </a>
            </Button>
          )}
        </div>
      </div>

      <Textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título do post"
        rows={1}
        className="min-h-0 resize-none border-none bg-transparent px-0 font-heading text-2xl shadow-none focus-visible:ring-0 md:text-3xl"
      />

      <CustomFieldsForm
        fields={fieldSchema}
        values={customFields}
        onChange={setCustomFields}
      />

      <RichTextEditor content={body} onChange={setBody} />

      <AttachmentsPanel postId={post.id} attachments={attachments} />

      {allTags.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">Condições clínicas</p>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => {
              const selected = tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    setTagIds((current) =>
                      selected
                        ? current.filter((id) => id !== tag.id)
                        : [...current, tag.id]
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Espaço</Label>
          <Select value={spaceId} onValueChange={setSpaceId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {spaces.map((space) => (
                <SelectItem key={space.id} value={space.id}>
                  {space.emoji} {space.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            Fixar no topo do espaço
            <Switch checked={isPinned} onCheckedChange={setIsPinned} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            Notificar membras ao publicar
            <Switch checked={notifyMembers} onCheckedChange={setNotifyMembers} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            Comentários encerrados
            <Switch
              checked={commentsClosed}
              onCheckedChange={setCommentsClosed}
            />
          </label>
        </div>
      </div>

      {post.status === "scheduled" && post.publish_at && (
        <p className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          <CalendarClock className="size-4" />
          Agendado para {formatDateTime(post.publish_at)}
        </p>
      )}

      <div className="sticky bottom-0 -mx-3 flex flex-wrap items-center gap-2 border-t bg-background/95 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4">
        <Button onClick={() => save()} disabled={pending} variant="outline">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        {post.status === "published" ? (
          <Button
            onClick={() =>
              save(() => unpublishPost(post.id), "Post despublicado.")
            }
            disabled={pending}
            variant="secondary"
          >
            Despublicar
          </Button>
        ) : (
          <>
            <Button
              onClick={() =>
                save(() => publishPost(post.id), "Post publicado!")
              }
              disabled={pending}
            >
              Publicar agora
            </Button>
            {post.status === "scheduled" ? (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  save(
                    () => cancelSchedule(post.id),
                    "Agendamento cancelado — o post voltou a rascunho."
                  )
                }
              >
                Cancelar agendamento
              </Button>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" disabled={pending}>
                    <CalendarClock className="size-4" /> Agendar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="flex w-72 flex-col gap-3">
                  <p className="text-sm font-medium">Publicar em:</p>
                  <Input
                    type="datetime-local"
                    value={scheduleValue}
                    onChange={(e) => setScheduleValue(e.target.value)}
                  />
                  <Button
                    disabled={!scheduleValue || pending}
                    onClick={() => {
                      const date = new Date(scheduleValue);
                      if (Number.isNaN(date.getTime()) || date <= new Date()) {
                        toast.error("Escolha uma data futura.");
                        return;
                      }
                      save(
                        () => schedulePost(post.id, date.toISOString()),
                        "Post agendado!"
                      );
                    }}
                  >
                    Confirmar agendamento
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Horário de Brasília. O post fica visível para as membras
                    exatamente neste horário.
                  </p>
                </PopoverContent>
              </Popover>
            )}
          </>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          disabled={pending}
          title="Duplicar post"
          onClick={() => startTransition(() => duplicatePost(post.id))}
        >
          <Copy className="size-4" />
          <span className="sr-only">Duplicar post</span>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" disabled={pending}>
              <Trash2 className="size-4 text-destructive" />
              <span className="sr-only">Excluir post</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este post?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser desfeita. Comentários e anexos vinculados
                também serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => startTransition(() => deletePost(post.id))}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
