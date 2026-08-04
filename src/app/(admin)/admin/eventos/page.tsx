import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { EventCreateButton } from "./event-dialog";

export const metadata: Metadata = { title: "Eventos" };

export default async function AdminEventsPage() {
  const supabase = await createClient();
  const [{ data: events }, { data: spaces }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, starts_at, canceled_at, completed_at, recording_post_id, spaces(name, emoji), event_rsvps(status), case_submissions(id)"
      )
      .order("starts_at", { ascending: false })
      .limit(50),
    supabase
      .from("spaces")
      .select("id, name, emoji")
      .eq("type", "events")
      .is("archived_at", null)
      .order("position"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl">Eventos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rounds Clínicos: agenda, confirmações, casos e gravações.
          </p>
        </div>
        <EventCreateButton spaces={spaces ?? []} />
      </div>

      {!events?.length ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum evento criado. Crie o próximo Round Clínico e as membras já
          podem confirmar presença e enviar casos.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {events.map((event) => {
            const going = event.event_rsvps.filter(
              (r) => r.status === "going"
            ).length;
            const upcoming =
              !event.canceled_at && new Date(event.starts_at) > new Date();
            return (
              <li key={event.id}>
                <Link
                  href={`/admin/eventos/${event.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.spaces?.emoji} {event.spaces?.name} ·{" "}
                      {formatDateTime(event.starts_at)} · {going} confirmadas ·{" "}
                      {event.case_submissions.length} casos
                    </p>
                  </div>
                  {event.canceled_at ? (
                    <Badge variant="destructive">Cancelado</Badge>
                  ) : upcoming ? (
                    <Badge>Próximo</Badge>
                  ) : event.recording_post_id ? (
                    <Badge variant="secondary">Com gravação</Badge>
                  ) : (
                    <Badge variant="outline">Sem gravação</Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
