"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";

export type TagResult = { ok: boolean; message?: string };

export async function createTag(name: string): Promise<TagResult> {
  await requireAdmin();
  const supabase = await createClient();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Informe o nome da tag." };
  const { error } = await supabase
    .from("tags")
    .insert({ name: trimmed, slug: slugify(trimmed) });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "Já existe uma tag com este nome."
          : "Não foi possível criar a tag.",
    };
  }
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function renameTag(id: string, name: string): Promise<TagResult> {
  await requireAdmin();
  const supabase = await createClient();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Informe o nome da tag." };
  const { error } = await supabase
    .from("tags")
    .update({ name: trimmed, slug: slugify(trimmed) })
    .eq("id", id);
  if (error) return { ok: false, message: "Não foi possível renomear a tag." };
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function deleteTag(id: string): Promise<TagResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return { ok: false, message: "Não foi possível excluir a tag." };
  revalidatePath("/admin/tags");
  return { ok: true };
}

/** Move every post from `dupeId` to `keepId`, then delete the duplicate. */
export async function mergeTags(
  keepId: string,
  dupeId: string
): Promise<TagResult> {
  await requireAdmin();
  if (keepId === dupeId)
    return { ok: false, message: "Escolha duas tags diferentes." };
  const supabase = await createClient();

  const { data: dupeLinks } = await supabase
    .from("post_tags")
    .select("post_id")
    .eq("tag_id", dupeId);

  if (dupeLinks && dupeLinks.length > 0) {
    await supabase.from("post_tags").upsert(
      dupeLinks.map((link) => ({ post_id: link.post_id, tag_id: keepId })),
      { onConflict: "post_id,tag_id", ignoreDuplicates: true }
    );
  }
  await supabase.from("tags").delete().eq("id", dupeId);
  revalidatePath("/admin/tags");
  return { ok: true };
}
