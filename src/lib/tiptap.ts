import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/react";

/** Extensions shared by the editor and the server-side HTML renderer. */
export function baseExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false },
    }),
    Image,
  ];
}

export const EMPTY_DOC: JSONContent = { type: "doc", content: [] };

/** Plain-text extraction for search indexing (posts.body_text). */
export function extractText(doc: unknown): string {
  const parts: string[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && n.text) parts.push(n.text);
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
      if (n.type !== "doc") parts.push("\n");
    }
  }
  walk(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function renderPostHtml(doc: unknown): string {
  try {
    return generateHTML(doc as JSONContent, baseExtensions());
  } catch {
    return "";
  }
}
