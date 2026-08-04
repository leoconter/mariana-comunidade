import { renderPostHtml } from "@/lib/tiptap";

export function PostBody({ body }: { body: unknown }) {
  const html = renderPostHtml(body);
  if (!html) return null;
  return (
    <div
      className="prose prose-neutral max-w-none prose-headings:font-heading prose-a:text-primary"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
