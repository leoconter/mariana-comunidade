import { NextResponse, type NextRequest } from "next/server";
import { getBunnyVideo, mapBunnyStatus } from "@/lib/bunny";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Bunny Stream webhook (configure the URL with ?secret=<JOBS_SECRET> —
 * Bunny does not sign its webhooks).
 * Payload: { VideoLibraryId, VideoGuid, Status }
 */
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.JOBS_SECRET || secret !== process.env.JOBS_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    VideoGuid?: string;
    Status?: number;
  } | null;

  if (!payload?.VideoGuid || typeof payload.Status !== "number") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const status = mapBunnyStatus(payload.Status);

  let duration: number | null = null;
  let thumbnail: string | null = null;
  if (status === "ready") {
    const details = await getBunnyVideo(payload.VideoGuid);
    duration = details?.lengthSeconds ?? null;
    thumbnail = details?.thumbnailUrl ?? null;
  }

  await supabase
    .from("media_assets")
    .update({
      bunny_status: status,
      ...(duration !== null ? { duration_seconds: duration } : {}),
      ...(thumbnail !== null ? { thumbnail_url: thumbnail } : {}),
    })
    .eq("bunny_video_id", payload.VideoGuid);

  return NextResponse.json({ ok: true });
}
