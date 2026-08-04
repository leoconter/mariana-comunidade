"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { kindFromMime } from "@/lib/media";

export type MediaActionResult = { ok: boolean; message?: string; id?: string };

/** Called after the browser uploaded the file straight to Storage. */
export async function registerMedia(input: {
  storagePath: string;
  filename: string;
  mime: string;
  sizeBytes: number;
}): Promise<MediaActionResult> {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      kind: kindFromMime(input.mime),
      title: input.filename.replace(/\.[^.]+$/, ""),
      filename: input.filename,
      mime: input.mime,
      size_bytes: input.sizeBytes,
      storage_path: input.storagePath,
      uploaded_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data)
    return { ok: false, message: "Não foi possível registrar o arquivo." };
  revalidatePath("/admin/midia");
  return { ok: true, id: data.id };
}

export async function renameMedia(
  id: string,
  title: string
): Promise<MediaActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, message: "Informe um nome." };
  const { error } = await supabase
    .from("media_assets")
    .update({ title: trimmed })
    .eq("id", id);
  if (error) return { ok: false, message: "Não foi possível renomear." };
  revalidatePath("/admin/midia");
  return { ok: true };
}

export async function deleteMedia(id: string): Promise<MediaActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { count } = await supabase
    .from("post_attachments")
    .select("id", { count: "exact", head: true })
    .eq("media_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `Este arquivo está em uso em ${count} post(s). Remova os anexos antes de excluir.`,
    };
  }

  const { data: asset } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (asset?.storage_path) {
    await supabase.storage.from("media").remove([asset.storage_path]);
  }
  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error) return { ok: false, message: "Não foi possível excluir." };
  revalidatePath("/admin/midia");
  return { ok: true };
}
