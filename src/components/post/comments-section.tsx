"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, Flag, Heart, Pin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  addComment,
  deleteOwnComment,
  reportComment,
  toggleCommentReaction,
} from "@/app/(member)/actions";
import { formatDateTime } from "@/lib/format";

export type CommentData = {
  id: string;
  body: string;
  parent_id: string | null;
  is_pinned: boolean;
  hidden_at: string | null;
  created_at: string;
  author: { id: string; full_name: string } | null;
  reactionCount: number;
  reactedByMe: boolean;
};

export function CommentsSection({
  postId,
  comments,
  currentUserId,
  commentsClosed,
}: {
  postId: string;
  comments: CommentData[];
  currentUserId: string;
  commentsClosed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<CommentData | null>(null);
  const [reportTarget, setReportTarget] = useState<CommentData | null>(null);
  const [reportReason, setReportReason] = useState("");

  const { roots, repliesByParent } = useMemo(() => {
    const roots = comments
      .filter((c) => !c.parent_id)
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return a.created_at.localeCompare(b.created_at);
      });
    const repliesByParent = new Map<string, CommentData[]>();
    for (const comment of comments) {
      if (!comment.parent_id) continue;
      if (!repliesByParent.has(comment.parent_id))
        repliesByParent.set(comment.parent_id, []);
      repliesByParent.get(comment.parent_id)!.push(comment);
    }
    return { roots, repliesByParent };
  }, [comments]);

  function submit() {
    startTransition(async () => {
      const result = await addComment(postId, body, replyTo?.id ?? null);
      if (result.ok) {
        setBody("");
        setReplyTo(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 border-t pt-6">
      <h2 className="text-lg">
        Comentários{" "}
        <span className="text-sm text-muted-foreground">
          ({comments.length})
        </span>
      </h2>

      {commentsClosed ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Os comentários deste post estão encerrados.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {replyTo && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CornerDownRight className="size-3" />
              Respondendo a {replyTo.author?.full_name ?? "comentário"}
              <button
                className="underline"
                onClick={() => setReplyTo(null)}
                type="button"
              >
                cancelar
              </button>
            </p>
          )}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva um comentário..."
            rows={3}
          />
          <Button
            className="self-end"
            size="sm"
            disabled={pending || !body.trim()}
            onClick={submit}
          >
            {pending ? "Enviando..." : "Comentar"}
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {roots.map((comment) => (
          <li key={comment.id}>
            <CommentItem
              comment={comment}
              currentUserId={currentUserId}
              onReply={() => setReplyTo(comment)}
              onReport={() => {
                setReportTarget(comment);
                setReportReason("");
              }}
              canReply={!commentsClosed}
            />
            {(repliesByParent.get(comment.id) ?? []).map((reply) => (
              <div key={reply.id} className="ml-8 mt-3">
                <CommentItem
                  comment={reply}
                  currentUserId={currentUserId}
                  onReport={() => {
                    setReportTarget(reply);
                    setReportReason("");
                  }}
                  canReply={false}
                />
              </div>
            ))}
          </li>
        ))}
      </ul>

      <Dialog
        open={reportTarget !== null}
        onOpenChange={(open) => !open && setReportTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Denunciar comentário</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              A moderação vai revisar este comentário. Se quiser, descreva o
              motivo:
            </p>
            <Textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={3}
              placeholder="Motivo (opcional)"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReportTarget(null)}>
                Cancelar
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    if (!reportTarget) return;
                    const result = await reportComment(
                      reportTarget.id,
                      reportReason
                    );
                    if (result.ok) {
                      toast.success("Denúncia enviada. Obrigada por avisar!");
                      setReportTarget(null);
                    } else toast.error(result.message);
                  })
                }
              >
                Denunciar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onReply,
  onReport,
  canReply,
}: {
  comment: CommentData;
  currentUserId: string;
  onReply?: () => void;
  onReport: () => void;
  canReply: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [reacted, setReacted] = useState(comment.reactedByMe);
  const [count, setCount] = useState(comment.reactionCount);
  const isMine = comment.author?.id === currentUserId;
  const initials = (comment.author?.full_name || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex gap-3">
      <Avatar className="size-8">
        <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {comment.author?.full_name || "Membra"}
          </span>
          <span>{formatDateTime(comment.created_at)}</span>
          {comment.is_pinned && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Pin className="size-3" /> Fixado
            </span>
          )}
          {comment.hidden_at && (
            <span className="text-destructive">Oculto pela moderação</span>
          )}
        </p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.body}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            className={`inline-flex items-center gap-1 ${reacted ? "text-primary" : ""}`}
            onClick={() => {
              const next = !reacted;
              setReacted(next);
              setCount((c) => c + (next ? 1 : -1));
              startTransition(() =>
                toggleCommentReaction(comment.id, next).catch(() => {})
              );
            }}
          >
            <Heart className={reacted ? "size-3.5 fill-current" : "size-3.5"} />
            {count > 0 && count}
          </button>
          {canReply && onReply && (
            <button type="button" onClick={onReply}>
              Responder
            </button>
          )}
          {isMine ? (
            <button
              type="button"
              className="inline-flex items-center gap-1"
              onClick={() =>
                startTransition(async () => {
                  await deleteOwnComment(comment.id);
                  router.refresh();
                })
              }
            >
              <Trash2 className="size-3.5" /> Excluir
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1"
              onClick={onReport}
            >
              <Flag className="size-3.5" /> Denunciar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
