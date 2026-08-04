import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImpactBadge } from "@/components/post/impact-badge";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Buscar" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; tipo?: string }>;
}) {
  const { q = "", tag = "", tipo = "" } = await searchParams;
  const supabase = await createClient();

  const [{ data: tags }, { data: postTypes }] = await Promise.all([
    supabase.from("tags").select("id, name, slug").order("name"),
    supabase
      .from("post_types")
      .select("id, key, name, emoji")
      .is("archived_at", null)
      .order("position"),
  ]);

  const hasFilters = Boolean(q.trim() || tag || tipo);
  let results: {
    id: string;
    title: string;
    body_text: string;
    published_at: string | null;
    publish_at: string | null;
    custom_fields: unknown;
    spaces: { slug: string; name: string; emoji: string | null } | null;
    post_types: { name: string; emoji: string | null } | null;
  }[] = [];

  if (hasFilters) {
    let query = supabase
      .from("posts")
      .select(
        "id, title, body_text, published_at, publish_at, custom_fields, spaces!inner(slug, name, emoji), post_types(name, emoji)" +
          (tag ? ", post_tags!inner(tag_id)" : "")
      )
      .in("status", ["published", "scheduled"])
      .order("publish_at", { ascending: false })
      .limit(40);

    if (q.trim()) {
      query = query.textSearch("search_tsv", q.trim(), {
        type: "websearch",
        config: "pt",
      });
    }
    if (tag) query = query.eq("post_tags.tag_id", tag);
    if (tipo) query = query.eq("post_type_id", tipo);

    const { data } = await query;
    // The select string is built dynamically (optional !inner join on
    // post_tags), which defeats supabase-js type inference.
    results = (data ?? []) as unknown as typeof results;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl">Buscar na biblioteca</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre a conduta certa quando a paciente difícil aparecer.
        </p>
      </div>

      <form className="flex flex-col gap-3" action="/buscar">
        <div className="flex gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Ex.: endometriose exame normal, dilatadores..."
            className="flex-1"
          />
          <Button type="submit">
            <SearchIcon className="size-4" />
            <span className="sr-only sm:not-sr-only">Buscar</span>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            name="tag"
            defaultValue={tag}
            className="h-9 rounded-lg border bg-card px-2 text-sm"
          >
            <option value="">Todas as condições</option>
            {(tags ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            name="tipo"
            defaultValue={tipo}
            className="h-9 rounded-lg border bg-card px-2 text-sm"
          >
            <option value="">Todos os tipos</option>
            {(postTypes ?? []).map((type) => (
              <option key={type.id} value={type.id}>
                {type.emoji} {type.name}
              </option>
            ))}
          </select>
        </div>
      </form>

      {!hasFilters ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <SearchIcon className="size-6 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Busque por condição, sintoma ou conduta — a busca ignora acentos e
            encontra o conteúdo dentro dos posts, não só nos títulos.
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          Nada encontrado. Tente outras palavras (ex.: “bexiga dolorosa” em vez
          de “cistite”) ou remova os filtros.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((post) => (
            <li key={post.id}>
              <Link
                href={`/e/${post.spaces?.slug}/p/${post.id}`}
                className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {post.spaces?.emoji} {post.spaces?.name}
                  </span>
                  {post.post_types && (
                    <span>
                      · {post.post_types.emoji} {post.post_types.name}
                    </span>
                  )}
                  {(post.published_at ?? post.publish_at) && (
                    <span>
                      · {formatDate(post.published_at ?? post.publish_at!)}
                    </span>
                  )}
                </div>
                <p className="mt-1 font-heading text-lg leading-snug">
                  {post.title || "(sem título)"}
                </p>
                <ImpactBadge
                  compact
                  value={
                    (post.custom_fields as Record<string, string>)
                      ?.clinical_impact
                  }
                />
                {post.body_text && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {post.body_text}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
