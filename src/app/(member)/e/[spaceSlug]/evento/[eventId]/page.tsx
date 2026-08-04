import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { CaseSubmissionForm, RsvpToggle } from "./event-interactions";

export default async function EventPage({
  params,
}: {
  params: Promise<{ spaceSlug: string; eventId: string }>;
}) {
  const { spaceSlug, eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: event } = await supabase
    .from("events")
    .select("*, spaces!inner(name, emoji, slug)")
    .eq("id", eventId)
    .eq("spaces.slug", spaceSlug)
    .single();

  if (!event) notFound();

  const [{ data: rsvp }, { data: myCases }] = await Promise.all([
    supabase
      .from("event_rsvps")
      .select("status")
      .eq("event_id", event.id)
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("case_submissions")
      .select("id, created_at, status")
      .eq("event_id", event.id)
      .eq("user_id", user!.id)
      .is("deleted_at", null),
  ]);

  const upcoming = new Date(event.starts_at) > new Date();
  const going = rsvp?.status === "going";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/e/${spaceSlug}`}>
            <ArrowLeft className="size-4" />
            {event.spaces.emoji} {event.spaces.name}
          </Link>
        </Button>
      </div>

      <header>
        <h1 className="text-2xl">{event.title}</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4" />
          {formatDateTime(event.starts_at)} · {event.duration_minutes} min
        </p>
        {event.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm">{event.description}</p>
        )}
      </header>

      {event.canceled_at ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Este encontro foi cancelado.
        </p>
      ) : upcoming ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
            <RsvpToggle eventId={event.id} initialGoing={going} />
            {going && event.meeting_url && (
              <Button asChild size="sm">
                <a href={event.meeting_url} target="_blank" rel="noreferrer">
                  <Video className="size-4" /> Entrar na call
                </a>
              </Button>
            )}
            {going && !event.meeting_url && (
              <p className="text-xs text-muted-foreground">
                O link da call aparece aqui perto do horário.
              </p>
            )}
          </div>

          {event.accepts_cases && (
            <CaseSubmissionForm
              eventId={event.id}
              alreadySubmitted={(myCases ?? []).length > 0}
            />
          )}
        </div>
      ) : event.recording_post_id ? (
        <Button asChild className="self-start">
          <Link href={`/e/${spaceSlug}/p/${event.recording_post_id}`}>
            <Video className="size-4" /> Assistir à gravação
          </Link>
        </Button>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Este encontro já aconteceu. A gravação será publicada em breve.
        </p>
      )}
    </div>
  );
}
