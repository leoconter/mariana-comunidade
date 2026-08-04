import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { PostCard, type PostCardData } from "@/components/post/post-card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Salvos" };

export default async function SavedPostsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: saved } = await supabase
    .from("saved_posts")
    .select(
      "created_at, posts(id, title, body_text, published_at, publish_at, custom_fields, spaces(slug, name, emoji), post_types(name, emoji))"
    )
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const posts = (saved ?? [])
    .map((row) => row.posts)
    .filter(Boolean) as unknown as PostCardData[];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl">Salvos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conteúdos que você guardou para ler (ou rever) com calma.
        </p>
      </div>
      {posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <Bookmark className="size-6 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Nada salvo ainda. Toque em “Salvar” dentro de qualquer post para
            guardá-lo aqui.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} showSpace />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
