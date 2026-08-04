"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_DOC, extractText } from "@/lib/tiptap";
import type { Json } from "@/lib/database.types";

function revalidatePost(postId?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/admin/posts");
  if (postId) revalidatePath(`/admin/posts/${postId}`);
}

export async function createPost(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const spaceId = String(formData.get("space_id") ?? "");
  const postTypeId = String(formData.get("post_type_id") ?? "") || null;
  if (!spaceId) throw new Error("Escolha um espaço.");

  let body: Json = EMPTY_DOC as Json;
  if (postTypeId) {
    const { data: postType } = await supabase
      .from("post_types")
      .select("body_template")
      .eq("id", postTypeId)
      .single();
    if (postType?.body_template) body = postType.body_template;
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      space_id: spaceId,
      post_type_id: postTypeId,
      author_id: profile.id,
      status: "draft",
      body,
    })
    .select("id")
    .single();

  if (error || !post) throw new Error("Não foi possível criar o post.");
  revalidatePost();
  redirect(`/admin/posts/${post.id}`);
}

export type SavePostInput = {
  id: string;
  title: string;
  body: Json;
  spaceId: string;
  customFields?: Json;
  tagIds?: string[];
  isPinned: boolean;
  commentsClosed: boolean;
  notifyMembers: boolean;
};

export async function savePost(input: SavePostInput) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("posts")
    .update({
      title: input.title.trim(),
      body: input.body,
      body_text: extractText(input.body),
      space_id: input.spaceId,
      ...(input.customFields !== undefined
        ? { custom_fields: input.customFields }
        : {}),
      is_pinned: input.isPinned,
      comments_closed: input.commentsClosed,
      notify_members: input.notifyMembers,
    })
    .eq("id", input.id);

  if (error) throw new Error("Não foi possível salvar o post.");

  if (input.tagIds) {
    await supabase.from("post_tags").delete().eq("post_id", input.id);
    if (input.tagIds.length > 0) {
      await supabase
        .from("post_tags")
        .insert(input.tagIds.map((tagId) => ({ post_id: input.id, tag_id: tagId })));
    }
  }
  revalidatePost(input.id);
}

export async function publishPost(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("posts")
    .update({ status: "published", published_at: now, publish_at: now })
    .eq("id", id);
  if (error) throw new Error("Não foi possível publicar o post.");
  revalidatePost(id);
}

export async function unpublishPost(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("posts")
    .update({ status: "draft", published_at: null, publish_at: null })
    .eq("id", id);
  if (error) throw new Error("Não foi possível despublicar o post.");
  revalidatePost(id);
}

export async function schedulePost(id: string, publishAtIso: string) {
  await requireAdmin();
  const supabase = await createClient();
  const publishAt = new Date(publishAtIso);
  if (Number.isNaN(publishAt.getTime()) || publishAt <= new Date()) {
    throw new Error("Escolha uma data futura.");
  }
  const { error } = await supabase
    .from("posts")
    .update({
      status: "scheduled",
      publish_at: publishAt.toISOString(),
      published_at: null,
    })
    .eq("id", id);
  if (error) throw new Error("Não foi possível agendar o post.");
  revalidatePost(id);
  revalidatePath("/admin/agenda");
}

export async function cancelSchedule(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("posts")
    .update({ status: "draft", publish_at: null })
    .eq("id", id);
  if (error) throw new Error("Não foi possível cancelar o agendamento.");
  revalidatePost(id);
  revalidatePath("/admin/agenda");
}

export async function duplicatePost(id: string) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { data: original } = await supabase
    .from("posts")
    .select("*, post_attachments(media_id, position, caption), post_tags(tag_id)")
    .eq("id", id)
    .single();
  if (!original) throw new Error("Post não encontrado.");

  const { data: copy, error } = await supabase
    .from("posts")
    .insert({
      space_id: original.space_id,
      post_type_id: original.post_type_id,
      author_id: profile.id,
      title: original.title ? `${original.title} (cópia)` : "",
      body: original.body,
      body_text: original.body_text,
      custom_fields: original.custom_fields,
      status: "draft",
      notify_members: original.notify_members,
    })
    .select("id")
    .single();
  if (error || !copy) throw new Error("Não foi possível duplicar o post.");

  if (original.post_attachments.length > 0) {
    await supabase.from("post_attachments").insert(
      original.post_attachments.map((a) => ({
        post_id: copy.id,
        media_id: a.media_id,
        position: a.position,
        caption: a.caption,
      }))
    );
  }
  if (original.post_tags.length > 0) {
    await supabase.from("post_tags").insert(
      original.post_tags.map((t) => ({ post_id: copy.id, tag_id: t.tag_id }))
    );
  }

  revalidatePost();
  redirect(`/admin/posts/${copy.id}`);
}

export async function addAttachment(postId: string, mediaId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase
    .from("post_attachments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  const { error } = await supabase.from("post_attachments").insert({
    post_id: postId,
    media_id: mediaId,
    position: count ?? 0,
  });
  if (error && error.code !== "23505")
    throw new Error("Não foi possível anexar o arquivo.");
  revalidatePost(postId);
}

export async function removeAttachment(attachmentId: string, postId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("post_attachments").delete().eq("id", attachmentId);
  revalidatePost(postId);
}

export async function deletePost(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw new Error("Não foi possível excluir o post.");
  revalidatePost();
  redirect("/admin/posts");
}
