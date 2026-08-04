import { Sparkles } from "lucide-react";
import { PostCard, type PostCardData } from "@/components/post/post-card";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Spaces are followed by default; an explicit membership with
  // following=false removes them from the home feed.
  const { data: memberships } = await supabase
    .from("space_memberships")
    .select("space_id, following")
    .eq("user_id", user!.id);
  const unfollowed = (memberships ?? [])
    .filter((m) => !m.following)
    .map((m) => m.space_id);

  let query = supabase
    .from("posts")
    .select(
      "id, title, body_text, is_pinned, published_at, publish_at, custom_fields, spaces(slug, name, emoji), post_types(name, emoji)"
    )
    .in("status", ["published", "scheduled"])
    .order("publish_at", { ascending: false })
    .limit(30);
  if (unfollowed.length > 0) {
    query = query.not("space_id", "in", `(${unfollowed.join(",")})`);
  }
  const { data: posts } = await query;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Início</h1>
      {!posts?.length ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
          <Sparkles className="size-8 text-primary" />
          <h2 className="font-heading text-2xl">Bem-vinda à comunidade!</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Seu feed vai reunir aqui tudo que for publicado nos espaços que você
            acompanha. Enquanto isso, explore os espaços na navegação.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post as PostCardData} showSpace />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
