import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { EventAdminActions } from "./event-admin-actions";

export const metadata: Metadata = { title: "Evento" };

export default async function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: spaces }, { data: videos }] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "*, spaces(name, emoji, slug), event_rsvps(status, profiles(full_name, email)), case_submissions(id, payload, status, created_at, profiles(full_name))"
        )
        .eq("id", eventId)
        .single(),
      supabase
        .from("spaces")
        .select("id, name, emoji")
        .eq("type", "events")
        .is("archived_at", null)
        .order("position"),
      supabase
        .from("media_assets")
        .select("id, title, duration_seconds")
        .eq("kind", "video")
        .eq("bunny_status", "ready")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (!event) notFound();

  const going = event.event_rsvps.filter((r) => r.status === "going");
  const cases = event.case_submissions.filter((c) => c.status !== "discussed");

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/admin/eventos">
            <ArrowLeft className="size-4" /> Eventos
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl">{event.title}</h1>
        <p className="text-sm text-muted-foreground">
          {event.spaces?.emoji} {event.spaces?.name} ·{" "}
          {formatDateTime(event.starts_at)}
          {event.canceled_at && " · CANCELADO"}
        </p>
      </div>

      <EventAdminActions event={event} spaces={spaces ?? []} videos={videos ?? []} />

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium">
          Confirmadas ({going.length})
        </h2>
        {going.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma confirmação ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {going.map((rsvp, index) => (
              <li key={index}>
                {rsvp.profiles?.full_name || rsvp.profiles?.email}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium">
          Casos submetidos ({event.case_submissions.length})
        </h2>
        {cases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum caso enviado ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {cases.map((submission) => {
              const payload = submission.payload as Record<string, string>;
              return (
                <li
                  key={submission.id}
                  className="rounded-lg border p-3 text-sm"
                >
                  <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {submission.profiles?.full_name || "Membra"}
                    </span>
                    {formatDateTime(submission.created_at)}
                    <Badge variant="outline">{submission.status}</Badge>
                  </p>
                  <dl className="flex flex-col gap-1.5">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Queixa principal
                      </dt>
                      <dd>{payload.chief_complaint}</dd>
                    </div>
                    {payload.history && (
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground">
                          História
                        </dt>
                        <dd>{payload.history}</dd>
                      </div>
                    )}
                    {payload.assessment && (
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground">
                          Avaliação / já tentado
                        </dt>
                        <dd>{payload.assessment}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        Dúvida
                      </dt>
                      <dd>{payload.question}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
