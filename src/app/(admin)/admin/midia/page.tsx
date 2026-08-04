import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { MediaLibrary } from "./media-library";

export const metadata: Metadata = { title: "Mídia" };

export default async function AdminMediaPage() {
  const supabase = await createClient();

  const { data: assets } = await supabase
    .from("media_assets")
    .select("*, post_attachments(post_id, posts(id, title))")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Biblioteca de mídia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo que já foi enviado, num só lugar. Reutilize arquivos nos posts em
          vez de enviar de novo.
        </p>
      </div>
      <MediaLibrary assets={assets ?? []} />
    </div>
  );
}
