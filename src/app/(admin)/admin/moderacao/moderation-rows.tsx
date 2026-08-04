"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Eye,
  EyeOff,
  MicOff,
  MoreHorizontal,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format";
import {
  banMember,
  moderatorDeleteComment,
  muteMember,
  resolveReport,
  setCommentHidden,
  setCommentPinned,
  unmuteMember,
} from "./actions";

type ModerationComment = {
  id: string;
  body: string;
  created_at: string;
  hidden_at: string | null;
  is_pinned: boolean;
  author: {
    id: string;
    full_name: string;
    muted_until: string | null;
    banned_at: string | null;
  } | null;
  posts: { id: string; title: string; spaces: { slug: string } | null } | null;
};

export function CommentModerationRow({
  comment,
}: {
  comment: ModerationComment;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const muted =
    comment.author?.muted_until &&
    new Date(comment.author.muted_until) > new Date();

  function run(action: () => Promise<void>, message: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(message);
        router.refresh();
      } catch {
        toast.error("Não foi possível concluir a ação.");
      }
    });
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {comment.author?.full_name ?? "Membra"}
          </span>
          <span>{formatDateTime(comment.created_at)}</span>
          {comment.posts && (
            <Link
              href={`/e/${comment.posts.spaces?.slug}/p/${comment.posts.id}`}
              className="underline underline-offset-2"
              target="_blank"
            >
              em “{comment.posts.title || "post"}”
            </Link>
          )}
          {comment.is_pinned && <Badge variant="secondary">Fixado</Badge>}
          {comment.hidden_at && <Badge variant="destructive">Oculto</Badge>}
          {muted && <Badge variant="outline">Silenciada</Badge>}
          {comment.author?.banned_at && (
            <Badge variant="destructive">Banida</Badge>
          )}
        </p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">
          {comment.body}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={pending}>
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Ações de moderação</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              run(
                () => setCommentHidden(comment.id, !comment.hidden_at),
                comment.hidden_at ? "Comentário reexibido." : "Comentário oculto."
              )
            }
          >
            {comment.hidden_at ? (
              <>
                <Eye className="size-4" /> Reexibir
              </>
            ) : (
              <>
                <EyeOff className="size-4" /> Ocultar
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              run(
                () => setCommentPinned(comment.id, !comment.is_pinned),
                comment.is_pinned ? "Comentário desafixado." : "Comentário fixado."
              )
            }
          >
            {comment.is_pinned ? (
              <>
                <PinOff className="size-4" /> Desafixar
              </>
            ) : (
              <>
                <Pin className="size-4" /> Fixar
              </>
            )}
          </DropdownMenuItem>
          {comment.author && (
            <>
              {muted ? (
                <DropdownMenuItem
                  onClick={() =>
                    run(
                      () => unmuteMember(comment.author!.id),
                      "Silêncio removido."
                    )
                  }
                >
                  <MicOff className="size-4" /> Remover silêncio
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() =>
                    run(
                      () => muteMember(comment.author!.id, 7),
                      "Membra silenciada por 7 dias."
                    )
                  }
                >
                  <MicOff className="size-4" /> Silenciar (7 dias)
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  run(() => banMember(comment.author!.id), "Membra banida.")
                }
              >
                <Ban className="size-4" /> Banir membra
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={() =>
              run(() => moderatorDeleteComment(comment.id), "Comentário excluído.")
            }
          >
            <Trash2 className="size-4" /> Excluir comentário
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

type ModerationReport = {
  id: string;
  reason: string | null;
  created_at: string;
  comments: {
    id: string;
    body: string;
    author: { full_name: string } | null;
  } | null;
  reporter: { full_name: string } | null;
};

export function ReportRow({ report }: { report: ModerationReport }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function resolve(resolution: "kept" | "removed") {
    startTransition(async () => {
      await resolveReport(report.id, resolution);
      toast.success(
        resolution === "removed"
          ? "Comentário ocultado e denúncia resolvida."
          : "Denúncia resolvida — comentário mantido."
      );
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {report.reporter?.full_name ?? "Membra"}
        </span>{" "}
        denunciou em {formatDateTime(report.created_at)}
        {report.reason && <> — “{report.reason}”</>}
      </p>
      <blockquote className="rounded-lg bg-muted px-3 py-2 text-sm">
        <span className="text-xs text-muted-foreground">
          {report.comments?.author?.full_name}:
        </span>{" "}
        {report.comments?.body}
      </blockquote>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => resolve("kept")}
        >
          Manter comentário
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => resolve("removed")}
        >
          Ocultar comentário
        </Button>
      </div>
    </li>
  );
}
