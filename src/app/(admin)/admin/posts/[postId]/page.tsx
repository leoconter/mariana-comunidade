import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PostEditorForm } from "./post-editor-form";

export const metadata: Metadata = { title: "Editar post" };

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const supabase = await createClient();

  const [{ data: post }, { data: spaces }, { data: attachments }, { data: tags }, { data: postTags }] =
    await Promise.all([
      supabase
        .from("posts")
        .select("*, post_types(name, emoji, field_schema), spaces(slug)")
        .eq("id", postId)
        .single(),
      supabase
        .from("spaces")
        .select("id, name, emoji, slug")
        .is("archived_at", null)
        .order("position"),
      supabase
        .from("post_attachments")
        .select("*, media_assets(*)")
        .eq("post_id", postId)
        .order("position"),
      supabase.from("tags").select("id, name").order("name"),
      supabase.from("post_tags").select("tag_id").eq("post_id", postId),
    ]);

  if (!post) notFound();

  return (
    <PostEditorForm
      post={post}
      spaces={spaces ?? []}
      attachments={attachments ?? []}
      allTags={tags ?? []}
      initialTagIds={(postTags ?? []).map((t) => t.tag_id)}
    />
  );
}
