import { createClient } from "@/lib/supabase/server";

/**
 * Short-lived signed URL for a private media object.
 * Call only after an RLS-authorized query proved the caller may see the post.
 */
export async function mediaSignedUrl(
  path: string,
  expiresInSeconds = 3600,
  download?: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("media")
    .createSignedUrl(path, expiresInSeconds, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}
