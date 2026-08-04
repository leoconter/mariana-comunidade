import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Agenda" };

export default async function AdminSchedulePage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, publish_at, spaces(name, emoji), post_types(name, emoji)")
    .eq("status", "scheduled")
    .order("publish_at", { ascending: true });

  const groups = new Map<string, NonNullable<typeof posts>>();
  for (const post of posts ?? []) {
    if (!post.publish_at) continue;
    const day = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(new Date(post.publish_at));
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(post);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Agenda de publicações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Posts agendados, na ordem em que vão ao ar (horário de Brasília).
        </p>
      </div>

      {groups.size === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <CalendarClock className="size-6 text-primary" />
          <p className="text-sm text-muted-foreground">
            Nada agendado. Grave com antecedência e agende a Conduta da Semana
            para as próximas segundas — o post entra no ar sozinho.
          </p>
          <Link
            href="/admin/posts/novo"
            className="text-sm font-medium text-primary underline underline-offset-2"
          >
            Criar post
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {[...groups.entries()].map(([day, dayPosts]) => (
            <div key={day}>
              <p className="pb-2 text-sm font-semibold capitalize">{day}</p>
              <ul className="divide-y rounded-xl border bg-card">
                {dayPosts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {post.title || "(sem título)"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {post.spaces?.emoji} {post.spaces?.name}
                          {post.post_types &&
                            ` · ${post.post_types.emoji} ${post.post_types.name}`}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {post.publish_at &&
                          formatDateTime(post.publish_at).split(", ").pop()}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
