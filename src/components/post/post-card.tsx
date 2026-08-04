import Link from "next/link";
import { Pin } from "lucide-react";
import { ImpactBadge } from "@/components/post/impact-badge";
import { formatDate } from "@/lib/format";

export type PostCardData = {
  id: string;
  title: string;
  body_text: string;
  is_pinned?: boolean;
  published_at: string | null;
  publish_at: string | null;
  custom_fields: unknown;
  spaces: { slug: string; name: string; emoji: string | null } | null;
  post_types: { name: string; emoji: string | null } | null;
};

export function PostCard({
  post,
  showSpace = false,
}: {
  post: PostCardData;
  showSpace?: boolean;
}) {
  if (!post.spaces) return null;
  return (
    <Link
      href={`/e/${post.spaces.slug}/p/${post.id}`}
      className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {post.is_pinned && <Pin className="size-3 text-primary" />}
        {showSpace && (
          <span>
            {post.spaces.emoji} {post.spaces.name}
          </span>
        )}
        {post.post_types && (
          <span>
            {showSpace && "· "}
            {post.post_types.emoji} {post.post_types.name}
          </span>
        )}
        {(post.published_at ?? post.publish_at) && (
          <span>· {formatDate(post.published_at ?? post.publish_at!)}</span>
        )}
      </div>
      <p className="mt-1 font-heading text-lg leading-snug">
        {post.title || "(sem título)"}
      </p>
      <ImpactBadge
        compact
        value={(post.custom_fields as Record<string, string>)?.clinical_impact}
      />
      {post.body_text && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {post.body_text}
        </p>
      )}
    </Link>
  );
}
