"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createBunnyVideo,
  getBunnyVideo,
  isBunnyConfigured,
  mapBunnyStatus,
  tusUploadSignature,
} from "@/lib/bunny";
import { createClient } from "@/lib/supabase/server";

export type VideoUploadTicket = {
  ok: boolean;
  message?: string;
  mediaId?: string;
  videoId?: string;
  signature?: string;
  expiration?: number;
  libraryId?: string;
};

export async function createVideoUpload(
  title: string,
  filename: string,
  sizeBytes: number
): Promise<VideoUploadTicket> {
  const profile = await requireAdmin();
  if (!isBunnyConfigured()) {
    return {
      ok: false,
      message:
        "Bunny Stream ainda não está configurado. Preencha as variáveis BUNNY_* no ambiente.",
    };
  }

  const supabase = await createClient();
  try {
    const videoId = await createBunnyVideo(title);
    const { data, error } = await supabase
      .from("media_assets")
      .insert({
        kind: "video",
        title,
        filename,
        mime: "video/mp4",
        size_bytes: sizeBytes,
        bunny_video_id: videoId,
        bunny_status: "created",
        uploaded_by: profile.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error();

    const ticket = tusUploadSignature(videoId);
    return { ok: true, mediaId: data.id, videoId, ...ticket };
  } catch {
    return { ok: false, message: "Não foi possível iniciar o upload do vídeo." };
  }
}

export async function markVideoUploaded(mediaId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("media_assets")
    .update({ bunny_status: "processing" })
    .eq("id", mediaId);
  revalidatePath("/admin/midia");
}

/** Fallback poll for when the Bunny webhook is missed. */
export async function refreshVideoStatus(mediaId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, bunny_video_id")
    .eq("id", mediaId)
    .single();
  if (!asset?.bunny_video_id) return;

  const details = await getBunnyVideo(asset.bunny_video_id);
  if (!details) return;

  await supabase
    .from("media_assets")
    .update({
      bunny_status: mapBunnyStatus(details.status),
      duration_seconds: details.lengthSeconds,
      thumbnail_url: details.thumbnailUrl,
    })
    .eq("id", mediaId);
  revalidatePath("/admin/midia");
}
