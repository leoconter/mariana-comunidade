import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Sparkles } from "lucide-react";
import { FollowButton } from "@/components/member/follow-button";
import { PostCard, type PostCardData } from "@/components/post/post-card";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ spaceSlug: string }>;
}) {
  const { spaceSlug } = await params;
  const supabase = await createClient();

  const { data: space } = await supabase
    .from("spaces")
    .select("*")
    .eq("slug", spaceSlug)
    .single();

  if (!space) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("space_memberships")
    .select("following")
    .eq("space_id", space.id)
    .eq("user_id", user!.id)
    .maybeSingle();

  const [{ data: posts }, { data: events }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, title, body_text, status, is_pinned, published_at, publish_at, custom_fields, post_types(emoji, name)"
      )
      .eq("space_id", space.id)
      .in("status", ["published", "scheduled"])
      .order("is_pinned", { ascending: false })
      .order("publish_at", { ascending: false })
      .limit(50),
    space.type === "events"
      ? supabase
          .from("events")
          .select("id, title, starts_at, duration_minutes, canceled_at, recording_post_id")
          .eq("space_id", space.id)
          .is("canceled_at", null)
          .order("starts_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: null }),
  ]);

  const now = new Date();
  const upcomingEvents = (events ?? [])
    .filter((e) => new Date(e.starts_at) > now)
    .reverse();
  const pastEvents = (events ?? []).filter((e) => new Date(e.starts_at) <= now);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">
            {space.emoji ? `${space.emoji} ` : ""}
            {space.name}
          </h1>
          {space.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {space.description}
            </p>
          )}
        </div>
        <FollowButton
          spaceId={space.id}
          initialFollowing={membership?.following ?? true}
        />
      </div>

      {space.type === "events" && upcomingEvents.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Próximos encontros
          </h2>
          {upcomingEvents.map((event) => (
            <Link
              key={event.id}
              href={`/e/${space.slug}/evento/${event.id}`}
              className="flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-card p-4 transition-colors hover:border-primary"
            >
              <CalendarClock className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-heading text-lg leading-snug">
                  {event.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(event.starts_at)} · {event.duration_minutes}{" "}
                  min · confirme presença e envie seu caso
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {space.type === "events" && pastEvents.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Encontros anteriores
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {pastEvents.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/e/${space.slug}/evento/${event.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.starts_at)}
                    </p>
                  </div>
                  {event.recording_post_id && (
                    <span className="text-xs text-primary">Gravação</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!posts?.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <Sparkles className="size-6 text-primary" />
          <p className="text-sm text-muted-foreground">
            Os conteúdos deste espaço vão aparecer aqui em breve. Fique de olho!
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard
                post={
                  {
                    ...post,
                    spaces: {
                      slug: space.slug,
                      name: space.name,
                      emoji: space.emoji,
                    },
                  } as PostCardData
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
