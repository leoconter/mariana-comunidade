"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("Acesso restrito.");
  return profile;
}

function revalidateNav() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/espacos");
}

export type SpaceFormResult = { ok: boolean; message?: string };

export async function saveSpace(
  _prev: SpaceFormResult,
  formData: FormData
): Promise<SpaceFormResult> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Informe o nome do espaço." };

  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = slugify(rawSlug || name);
  if (!slug) return { ok: false, message: "Slug inválido." };

  const values = {
    name,
    slug,
    emoji: String(formData.get("emoji") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    type: String(formData.get("type") ?? "feed"),
    section_id: String(formData.get("section_id") ?? "") || null,
    visibility: String(formData.get("visibility") ?? "all"),
    allow_member_posts: formData.get("allow_member_posts") === "on",
    allow_comments: formData.get("allow_comments") === "on",
  };

  if (id) {
    const { error } = await supabase.from("spaces").update(values).eq("id", id);
    if (error) {
      return {
        ok: false,
        message:
          error.code === "23505"
            ? "Já existe um espaço com este slug."
            : "Não foi possível salvar o espaço.",
      };
    }
  } else {
    const { count } = await supabase
      .from("spaces")
      .select("id", { count: "exact", head: true });
    const { error } = await supabase
      .from("spaces")
      .insert({ ...values, position: count ?? 0 });
    if (error) {
      return {
        ok: false,
        message:
          error.code === "23505"
            ? "Já existe um espaço com este slug."
            : "Não foi possível criar o espaço.",
      };
    }
  }

  revalidateNav();
  return { ok: true };
}

export async function setSpaceArchived(id: string, archived: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("spaces")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  revalidateNav();
}

export async function deleteSpace(id: string): Promise<SpaceFormResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("space_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `Este espaço tem ${count} post(s). Arquive-o em vez de excluir, ou remova os posts antes.`,
    };
  }

  const { error } = await supabase.from("spaces").delete().eq("id", id);
  if (error) return { ok: false, message: "Não foi possível excluir o espaço." };
  revalidateNav();
  return { ok: true };
}

export async function reorderSpaces(
  items: { id: string; sectionId: string | null; position: number }[]
) {
  await requireAdmin();
  const supabase = await createClient();
  await Promise.all(
    items.map((item) =>
      supabase
        .from("spaces")
        .update({ section_id: item.sectionId, position: item.position })
        .eq("id", item.id)
    )
  );
  revalidateNav();
}

export async function saveSection(
  _prev: SpaceFormResult,
  formData: FormData
): Promise<SpaceFormResult> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Informe o nome da seção." };

  if (id) {
    await supabase.from("sections").update({ name }).eq("id", id);
  } else {
    const { count } = await supabase
      .from("sections")
      .select("id", { count: "exact", head: true });
    await supabase.from("sections").insert({ name, position: count ?? 0 });
  }
  revalidateNav();
  return { ok: true };
}

export async function deleteSection(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  // Spaces in the section keep existing (section_id becomes null via FK).
  await supabase.from("sections").delete().eq("id", id);
  revalidateNav();
}

export async function reorderSections(ids: string[]) {
  await requireAdmin();
  const supabase = await createClient();
  await Promise.all(
    ids.map((id, index) =>
      supabase.from("sections").update({ position: index }).eq("id", id)
    )
  );
  revalidateNav();
}
