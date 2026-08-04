import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  FolderKanban,
  PenSquare,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel" };

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();

  const [
    { count: activeMembers },
    { count: newThisMonth },
    { count: canceledThisMonth },
    { data: topPosts },
    { data: upcoming },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .neq("role", "admin")
      .is("banned_at", null)
      .gt("access_valid_until", nowIso),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStartIso),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .gte("canceled_at", monthStartIso),
    supabase
      .from("posts")
      .select("id, title, spaces(slug), post_views(count), comments(count)")
      .eq("status", "published")
      .limit(50),
    supabase
      .from("posts")
      .select("id, title, publish_at, spaces(name, emoji)")
      .eq("status", "scheduled")
      .order("publish_at", { ascending: true })
      .limit(5),
  ]);

  const ranked = (topPosts ?? [])
    .map((post) => ({
      ...post,
      views: post.post_views[0]?.count ?? 0,
      commentCount: post.comments[0]?.count ?? 0,
    }))
    .sort((a, b) => b.views + b.commentCount * 2 - (a.views + a.commentCount * 2))
    .slice(0, 5);

  const stats = [
    { label: "Membras ativas", value: activeMembers ?? 0 },
    { label: "Novas no mês", value: newThisMonth ?? 0 },
    { label: "Cancelamentos no mês", value: canceledThisMonth ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">Painel</h1>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col gap-1">
              <p className="font-heading text-3xl text-primary">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="size-4" /> Próximas publicações
          </h2>
          {!upcoming?.length ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Nada agendado.{" "}
              <Link href="/admin/posts/novo" className="text-primary underline">
                Agendar a próxima Conduta
              </Link>
            </p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {upcoming.map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/admin/posts/${post.id}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-accent/40"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {post.spaces?.emoji} {post.title || "(sem título)"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {post.publish_at && formatDateTime(post.publish_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Posts mais engajados
          </h2>
          {!ranked.length ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Publique os primeiros conteúdos para ver o engajamento aqui.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {ranked.map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/e/${post.spaces?.slug}/p/${post.id}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-accent/40"
                  >
                    <span className="min-w-0 flex-1 truncate">{post.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {post.views} vistas · {post.commentCount} comentários
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/admin/posts/novo", title: "Criar post", icon: PenSquare },
          { href: "/admin/espacos", title: "Espaços", icon: FolderKanban },
          { href: "/admin/membros", title: "Membros", icon: Users },
        ].map(({ href, title, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="flex items-center gap-2">
                <Icon className="size-4 text-primary" />
                <p className="text-sm font-medium">{title}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
