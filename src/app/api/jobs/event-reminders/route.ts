import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateEmail } from "@/lib/email";

/**
 * Sends 24h and 1h reminders to confirmed attendees. Idempotent via the
 * reminder_*_sent_at markers — safe to run every few minutes.
 */
export async function POST(request: NextRequest) {
  if (
    !process.env.JOBS_SECRET ||
    request.headers.get("x-jobs-secret") !== process.env.JOBS_SECRET
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = Date.now();
  const in24h = new Date(now + 24 * 3600 * 1000).toISOString();
  const in1h = new Date(now + 3600 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  let sent = 0;

  for (const window of [
    { column: "reminder_24h_sent_at" as const, until: in24h, label: "amanhã" },
    { column: "reminder_1h_sent_at" as const, until: in1h, label: "em 1 hora" },
  ]) {
    const { data: events } = await supabase
      .from("events")
      .select(
        "id, title, starts_at, meeting_url, event_rsvps(user_id, status, profiles(email, full_name))"
      )
      .is("canceled_at", null)
      .is(window.column, null)
      .gt("starts_at", nowIso)
      .lte("starts_at", window.until);

    for (const event of events ?? []) {
      // Mark first so a crash mid-send cannot double-email on the next run.
      await supabase
        .from("events")
        .update(
          window.column === "reminder_24h_sent_at"
            ? { reminder_24h_sent_at: nowIso }
            : { reminder_1h_sent_at: nowIso }
        )
        .eq("id", event.id);

      const confirmed = event.event_rsvps.filter((r) => r.status === "going");
      for (const rsvp of confirmed) {
        if (!rsvp.profiles?.email) continue;
        await supabase.from("notifications").insert({
          user_id: rsvp.user_id,
          kind: "event_reminder",
          event_id: event.id,
        });
        await sendTemplateEmail({
          templateKey: "event_reminder",
          to: rsvp.profiles.email,
          userId: rsvp.user_id,
          variables: {
            nome: (rsvp.profiles.full_name ?? "").split(" ")[0] || "colega",
            titulo: event.title,
            quando: window.label,
            url_call:
              event.meeting_url ??
              `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/`,
          },
          related: { event_id: event.id, window: window.label },
        });
        sent += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
