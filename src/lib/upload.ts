import { createClient } from "@/lib/supabase/client";

/** Browser-side upload to the private `media` bucket. Returns the storage path. */
export async function uploadToMediaBucket(file: File): Promise<string> {
  const supabase = createClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${crypto.randomUUID()}/${safeName}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error("Falha no upload do arquivo.");
  return path;
}
