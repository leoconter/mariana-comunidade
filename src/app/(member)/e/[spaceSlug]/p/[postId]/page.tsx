import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostToolbar } from "@/components/member/post-toolbar";
import { CommentsSection } from "@/components/post/comments-section";
import { ImpactBadge } from "@/components/post/impact-badge";
import { PostReaction } from "@/components/post/post-reaction";
import {
  PostAttachments,
  PostVideos,
} from "@/components/post/post-attachments";
import { PostBody } from "@/components/post/post-body";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function PostPage({
  params,
}: {
  params: Promise<{ spaceSlug: string; postId: string }>;
}) {
  const { spaceSlug, postId } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select(
      "*, spaces!inner(name, emoji, slug), post_types(name, emoji), profiles:author_id(full_name)"
    )
    .eq("id", postId)
    .eq("spaces.slug", spaceSlug)
    .single();

  if (!post) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: attachments },
    { data: postTags },
    { data: savedRow },
    { data: postReactions },
    { data: comments },
  ] = await Promise.all([
    supabase
      .from("post_attachments")
      .select("*, media_assets(*)")
      .eq("post_id", post.id)
      .order("position"),
    supabase.from("post_tags").select("tags(id, name)").eq("post_id", post.id),
    supabase
      .from("saved_posts")
      .select("post_id")
      .eq("post_id", post.id)
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase.from("reactions").select("user_id").eq("post_id", post.id),
    supabase
      .from("comments")
      .select(
        "id, body, parent_id, is_pinned, hidden_at, created_at, author:profiles!comments_author_id_fkey(id, full_name), reactions(user_id)"
      )
      .eq("post_id", post.id)
      .order("created_at"),
  ]);

  const videoMediaIds = (attachments ?? [])
    .filter((a) => a.media_assets?.kind === "video")
    .map((a) => a.media_id);
  const videoStartSeconds: Record<string, number> = {};
  if (videoMediaIds.length > 0) {
    const { data: progress } = await supabase
      .from("media_progress")
      .select("media_id, seconds, completed")
      .in("media_id", videoMediaIds)
      .eq("user_id", user!.id);
    for (const row of progress ?? []) {
      if (!row.completed) videoStartSeconds[row.media_id] = Number(row.seconds);
    }
  }

  return (
    <article className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/e/${spaceSlug}`}>
            <ArrowLeft className="size-4" />
            {post.spaces.emoji} {post.spaces.name}
          </Link>
        </Button>
        <PostToolbar postId={post.id} initialSaved={Boolean(savedRow)} />
      </div>
      <header>
        <h1 className="text-2xl leading-snug md:text-3xl">
          {post.title || "(sem título)"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {post.profiles?.full_name && <>{post.profiles.full_name} · </>}
          {(post.published_at ?? post.publish_at) &&
            formatDate(post.published_at ?? post.publish_at!)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ImpactBadge
            value={
              (post.custom_fields as Record<string, string>)?.clinical_impact
            }
          />
          {(postTags ?? []).map(
            (pt) =>
              pt.tags && (
                <Link
                  key={pt.tags.id}
                  href={`/buscar?tag=${pt.tags.id}`}
                  className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                >
                  {pt.tags.name}
                </Link>
              )
          )}
        </div>
      </header>
      <PostVideos
        attachments={attachments ?? []}
        videoStartSeconds={videoStartSeconds}
      />
      <PostBody body={post.body} />
      <PostAttachments attachments={attachments ?? []} />
      <div>
        <PostReaction
          postId={post.id}
          initialCount={(postReactions ?? []).length}
          initialReacted={(postReactions ?? []).some(
            (r) => r.user_id === user!.id
          )}
        />
      </div>
      <CommentsSection
        postId={post.id}
        currentUserId={user!.id}
        commentsClosed={post.comments_closed}
        comments={(comments ?? []).map((comment) => ({
          id: comment.id,
          body: comment.body,
          parent_id: comment.parent_id,
          is_pinned: comment.is_pinned,
          hidden_at: comment.hidden_at,
          created_at: comment.created_at,
          author: comment.author,
          reactionCount: comment.reactions.length,
          reactedByMe: comment.reactions.some((r) => r.user_id === user!.id),
        }))}
      />
    </article>
  );
}
