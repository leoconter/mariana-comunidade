import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TagsManager } from "./tags-manager";

export const metadata: Metadata = { title: "Tags" };

export default async function AdminTagsPage() {
  const supabase = await createClient();
  const { data: tags } = await supabase
    .from("tags")
    .select("*, post_tags(post_id)")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Tags de condição clínica</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          As tags alimentam os filtros da busca. Menos é mais: prefira poucas
          tags consistentes a muitas variações.
        </p>
      </div>
      <TagsManager
        tags={(tags ?? []).map((tag) => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          usage: tag.post_tags.length,
        }))}
      />
    </div>
  );
}
