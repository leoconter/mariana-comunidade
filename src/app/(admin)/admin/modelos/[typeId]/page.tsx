import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditorForm } from "./template-editor-form";

export const metadata: Metadata = { title: "Editar modelo" };

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ typeId: string }>;
}) {
  const { typeId } = await params;
  const supabase = await createClient();
  const { data: postType } = await supabase
    .from("post_types")
    .select("*")
    .eq("id", typeId)
    .single();

  if (!postType) notFound();

  return <TemplateEditorForm postType={postType} />;
}
