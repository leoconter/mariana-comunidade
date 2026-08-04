"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRawEmail } from "@/lib/email";

export type AnnouncementResult = { ok: boolean; message?: string };

export async function createAnnouncement(input: {
  title: string;
  bodyText: string;
  bannerDays: number;
  sendEmail: boolean;
}): Promise<AnnouncementResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const title = input.title.trim();
  if (!title) return { ok: false, message: "Informe o título do comunicado." };

  const bannerUntil =
    input.bannerDays > 0
      ? new Date(Date.now() + input.bannerDays * 24 * 3600 * 1000).toISOString()
      : null;

  const { data: announcement, error } = await supabase
    .from("announcements")
    .insert({
      title,
      body: {
        type: "doc",
        content: input.bodyText
          .split("\n")
          .filter(Boolean)
          .map((line) => ({
            type: "paragraph",
            content: [{ type: "text", text: line }],
          })),
      },
      show_banner_until: bannerUntil,
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !announcement)
    return { ok: false, message: "Não foi possível criar o comunicado." };

  let emailed = 0;
  if (input.sendEmail) {
    const adminClient = createAdminClient();
    const { data: members } = await adminClient
      .from("profiles")
      .select("id, email, full_name, email_prefs, banned_at, access_valid_until")
      .is("banned_at", null)
      .gt("access_valid_until", new Date().toISOString());

    const html = `<p>${input.bodyText.replaceAll("\n", "</p><p>")}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}">Abrir a comunidade</a></p>`;
    for (const member of members ?? []) {
      const prefs = (member.email_prefs ?? {}) as { announcements?: boolean };
      if (prefs.announcements === false) continue;
      await sendRawEmail({
        to: member.email,
        userId: member.id,
        subject: title,
        html,
        related: { announcement_id: announcement.id },
      });
      emailed += 1;
    }
    await supabase
      .from("announcements")
      .update({ emailed_at: new Date().toISOString() })
      .eq("id", announcement.id);
  }

  revalidatePath("/admin/comunicados");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: input.sendEmail
      ? `Comunicado publicado e enviado para ${emailed} membras.`
      : "Comunicado publicado.",
  };
}

export async function saveEmailTemplate(input: {
  key: string;
  subject: string;
  bodyHtml: string;
}): Promise<AnnouncementResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("email_templates")
    .update({ subject: input.subject.trim(), body_html: input.bodyHtml })
    .eq("key", input.key);
  if (error) return { ok: false, message: "Não foi possível salvar o modelo." };
  revalidatePath("/admin/comunicados");
  return { ok: true };
}
