import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notificações" };

const KIND_LABELS: Record<string, string> = {
  new_post: "Novo conteúdo",
  comment_reply: "Resposta ao seu comentário",
  post_comment: "Comentário no seu post",
  event_reminder: "Lembrete de evento",
  announcement: "Comunicado",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: notifications } = await supabase
    .from("notifications")
    .select(
      "id, kind, read_at, created_at, posts(id, title, spaces(slug)), events(id, title, spaces(slug))"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Opening the page marks everything as read.
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user!.id)
    .is("read_at", null);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl">Notificações</h1>
      {!notifications?.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <BellOff className="size-6 text-primary" />
          <p className="text-sm text-muted-foreground">
            Nada por aqui ainda. Você será avisada quando saírem novos
            conteúdos, respostas e lembretes de eventos.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {notifications.map((notification) => {
            const href = notification.posts
              ? `/e/${notification.posts.spaces?.slug}/p/${notification.posts.id}`
              : notification.events
                ? `/e/${notification.events.spaces?.slug}/evento/${notification.events.id}`
                : "/";
            const title =
              notification.posts?.title ?? notification.events?.title ?? "";
            return (
              <li key={notification.id}>
                <Link
                  href={href}
                  className={`flex flex-col gap-0.5 px-4 py-3 hover:bg-accent/40 ${
                    notification.read_at ? "" : "bg-secondary/40"
                  }`}
                >
                  <span className="text-xs text-muted-foreground">
                    {KIND_LABELS[notification.kind] ?? notification.kind} ·{" "}
                    {formatDateTime(notification.created_at)}
                  </span>
                  <span className="text-sm font-medium">{title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
