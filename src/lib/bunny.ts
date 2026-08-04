import "server-only";
import { createHash } from "node:crypto";

const API_BASE = "https://video.bunnycdn.com";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Bunny Stream não configurado (${name}).`);
  return value;
}

export function isBunnyConfigured(): boolean {
  return Boolean(
    process.env.BUNNY_STREAM_LIBRARY_ID && process.env.BUNNY_STREAM_API_KEY
  );
}

export async function createBunnyVideo(title: string): Promise<string> {
  const libraryId = env("BUNNY_STREAM_LIBRARY_ID");
  const response = await fetch(`${API_BASE}/library/${libraryId}/videos`, {
    method: "POST",
    headers: {
      AccessKey: env("BUNNY_STREAM_API_KEY"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error("Falha ao criar o vídeo no Bunny Stream.");
  const data = (await response.json()) as { guid: string };
  return data.guid;
}

export type BunnyVideoDetails = {
  status: number;
  lengthSeconds: number | null;
  thumbnailUrl: string | null;
};

export async function getBunnyVideo(
  videoId: string
): Promise<BunnyVideoDetails | null> {
  const libraryId = env("BUNNY_STREAM_LIBRARY_ID");
  const response = await fetch(
    `${API_BASE}/library/${libraryId}/videos/${videoId}`,
    { headers: { AccessKey: env("BUNNY_STREAM_API_KEY") } }
  );
  if (!response.ok) return null;
  const data = (await response.json()) as {
    status: number;
    length: number;
    thumbnailFileName?: string;
  };
  const cdnHost = process.env.BUNNY_STREAM_CDN_HOST;
  return {
    status: data.status,
    lengthSeconds: data.length || null,
    thumbnailUrl:
      cdnHost && data.thumbnailFileName
        ? `https://${cdnHost}/${videoId}/${data.thumbnailFileName}`
        : null,
  };
}

/** Presignature for browser TUS upload (sha256 of libraryId + apiKey + expiration + videoId). */
export function tusUploadSignature(videoId: string): {
  signature: string;
  expiration: number;
  libraryId: string;
} {
  const libraryId = env("BUNNY_STREAM_LIBRARY_ID");
  const apiKey = env("BUNNY_STREAM_API_KEY");
  const expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 6; // 6h to finish the upload
  const signature = createHash("sha256")
    .update(`${libraryId}${apiKey}${expiration}${videoId}`)
    .digest("hex");
  return { signature, expiration, libraryId };
}

/**
 * Signed embed URL (library must have Token Authentication enabled).
 * token = sha256(embedTokenKey + videoId + expires)
 */
export function signedEmbedUrl(
  videoId: string,
  options: { startAtSeconds?: number } = {}
): string {
  const libraryId = env("BUNNY_STREAM_LIBRARY_ID");
  const tokenKey = process.env.BUNNY_EMBED_TOKEN_KEY;
  const params = new URLSearchParams({ autoplay: "false", preload: "true" });

  if (tokenKey) {
    const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 6;
    const token = createHash("sha256")
      .update(`${tokenKey}${videoId}${expires}`)
      .digest("hex");
    params.set("token", token);
    params.set("expires", String(expires));
  }
  if (options.startAtSeconds && options.startAtSeconds > 5) {
    params.set("t", String(Math.floor(options.startAtSeconds)));
  }
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?${params.toString()}`;
}

/** Bunny video status codes → media_assets.bunny_status */
export function mapBunnyStatus(
  status: number
): "processing" | "ready" | "failed" {
  if (status === 3 || status === 4) return "ready";
  if (status === 5 || status === 6) return "failed";
  return "processing";
}
