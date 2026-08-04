"use client";

import { useEffect, useRef } from "react";
import { saveMediaProgress } from "@/app/(member)/actions";

/**
 * Renders the Bunny embed iframe and records watch progress via the
 * player.js postMessage protocol (throttled to ~10s).
 */
export function VideoFrame({
  src,
  title,
  mediaId,
}: {
  src: string;
  title: string;
  mediaId: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSavedRef = useRef(0);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow)
        return;
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const message = data as {
        context?: string;
        event?: string;
        value?: { seconds?: number; duration?: number };
      };
      if (message.context !== "player.js") return;

      if (message.event === "timeupdate" && message.value?.seconds) {
        const { seconds, duration } = message.value;
        const now = Date.now();
        if (now - lastSavedRef.current > 10_000) {
          lastSavedRef.current = now;
          const completed = Boolean(duration && seconds / duration > 0.95);
          saveMediaProgress(mediaId, seconds, completed).catch(() => {});
        }
      }
      if (message.event === "ended") {
        saveMediaProgress(mediaId, 0, true).catch(() => {});
      }
    }

    window.addEventListener("message", onMessage);
    // player.js handshake: ask the player to start emitting events.
    const iframe = iframeRef.current;
    const listen = () => {
      iframe?.contentWindow?.postMessage(
        JSON.stringify({
          context: "player.js",
          version: "0.0.11",
          method: "addEventListener",
          value: "timeupdate",
        }),
        "*"
      );
      iframe?.contentWindow?.postMessage(
        JSON.stringify({
          context: "player.js",
          version: "0.0.11",
          method: "addEventListener",
          value: "ended",
        }),
        "*"
      );
    };
    iframe?.addEventListener("load", listen);
    return () => {
      window.removeEventListener("message", onMessage);
      iframe?.removeEventListener("load", listen);
    };
  }, [mediaId]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title}
      loading="lazy"
      className="aspect-video w-full"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}
