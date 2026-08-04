"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export type TemplateResult = { ok: boolean; message?: string };

export async function saveTemplate(input: {
  id: string;
  name: string;
  emoji: string;
  description: string;
  bodyTemplate: Json;
  fieldSchemaJson: string;
}): Promise<TemplateResult> {
  await requireAdmin();
  const supabase = await createClient();

  let fieldSchema: Json;
  try {
    fieldSchema = JSON.parse(input.fieldSchemaJson) as Json;
    if (!Array.isArray(fieldSchema)) throw new Error();
  } catch {
    return {
      ok: false,
      message: "Campos extras inválidos — precisa ser uma lista JSON válida.",
    };
  }

  const { error } = await supabase
    .from("post_types")
    .update({
      name: input.name.trim(),
      emoji: input.emoji.trim() || null,
      description: input.description.trim() || null,
      body_template: input.bodyTemplate,
      field_schema: fieldSchema,
    })
    .eq("id", input.id);

  if (error) return { ok: false, message: "Não foi possível salvar o modelo." };
  revalidatePath("/admin/modelos");
  revalidatePath(`/admin/modelos/${input.id}`);
  revalidatePath("/admin/posts/novo");
  return { ok: true };
}
