"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type EventFormResult = { ok: boolean; message?: string };

function revalidateEvents(eventId?: string) {
  revalidatePath("/admin/eventos");
  if (eventId) revalidatePath(`/admin/eventos/${eventId}`);
  revalidatePath("/", "layout");
}

export async function saveEvent(
  _prev: EventFormResult,
  formData: FormData
): Promise<EventFormResult> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const startsAtLocal = String(formData.get("starts_at") ?? "");
  const spaceId = String(formData.get("space_id") ?? "");
  if (!title || !startsAtLocal || !spaceId) {
    return { ok: false, message: "Preencha título, espaço e data." };
  }
  const startsAt = new Date(startsAtLocal);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, message: "Data inválida." };
  }

  const values = {
    title,
    space_id: spaceId,
    starts_at: startsAt.toISOString(),
    duration_minutes: Number(formData.get("duration_minutes") ?? 60) || 60,
    meeting_url: String(formData.get("meeting_url") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    accepts_cases: formData.get("accepts_cases") === "on",
  };

  if (id) {
    const { error } = await supabase.from("events").update(values).eq("id", id);
    if (error) return { ok: false, message: "Não foi possível salvar o evento." };
  } else {
    const { error } = await supabase.from("events").insert(values);
    if (error) return { ok: false, message: "Não foi possível criar o evento." };
  }
  revalidateEvents(id || undefined);
  return { ok: true };
}

export async function cancelEvent(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("events")
    .update({ canceled_at: new Date().toISOString() })
    .eq("id", id);
  revalidateEvents(id);
}

/**
 * Attaches a processed video as the event recording: creates a published post
 * in the event's space with the video attached and links it to the event.
 */
export async function attachRecording(
  eventId: string,
  mediaId: string
): Promise<EventFormResult> {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, starts_at, space_id")
    .eq("id", eventId)
    .single();
  if (!event) return { ok: false, message: "Evento não encontrado." };

  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(event.starts_at));

  const now = new Date().toISOString();
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      space_id: event.space_id,
      author_id: profile.id,
      title: `Gravação — ${event.title} (${dateLabel})`,
      body_text: `Gravação do encontro ${event.title} de ${dateLabel}.`,
      status: "published",
      published_at: now,
      publish_at: now,
      notify_members: false,
    })
    .select("id")
    .single();
  if (error || !post)
    return { ok: false, message: "Não foi possível criar o post da gravação." };

  await supabase
    .from("post_attachments")
    .insert({ post_id: post.id, media_id: mediaId, position: 0 });

  await supabase
    .from("events")
    .update({
      recording_post_id: post.id,
      completed_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  revalidateEvents(eventId);
  return { ok: true };
}
