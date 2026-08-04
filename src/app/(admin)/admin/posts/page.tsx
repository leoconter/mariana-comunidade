import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Posts" };

const STATUS_TABS = [
  { value: "todos", label: "Todos" },
  { value: "draft", label: "Rascunhos" },
  { value: "scheduled", label: "Agendados" },
  { value: "published", label: "Publicados" },
];

const STATUS_BADGES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  draft: { label: "Rascunho", variant: "outline" },
  scheduled: { label: "Agendado", variant: "secondary" },
  published: { label: "Publicado", variant: "default" },
  archived: { label: "Arquivado", variant: "outline" },
};

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "todos" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select("id, title, status, publish_at, published_at, updated_at, spaces(name, emoji)")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (status !== "todos") query = query.eq("status", status);
  const { data: posts } = await query;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl">Posts</h1>
        <Button asChild>
          <Link href="/admin/posts/novo">
            <Plus className="size-4" /> Novo post
          </Link>
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={
              tab.value === "todos"
                ? "/admin/posts"
                : `/admin/posts?status=${tab.value}`
            }
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-sm",
              status === tab.value
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!posts?.length ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum post por aqui ainda. Crie o primeiro clicando em “Novo post”.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {posts.map((post) => {
            const badge = STATUS_BADGES[post.status] ?? STATUS_BADGES.draft;
            return (
              <li key={post.id}>
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {post.title || "(sem título)"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {post.spaces?.emoji} {post.spaces?.name} · atualizado{" "}
                      {formatDateTime(post.updated_at)}
                    </p>
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
