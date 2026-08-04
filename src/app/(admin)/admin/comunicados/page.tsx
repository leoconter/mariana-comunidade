import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { AnnouncementForm, EmailTemplatesEditor } from "./comunicados-ui";

export const metadata: Metadata = { title: "Comunicados" };

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const [{ data: announcements }, { data: templates }, { data: emailLog }] =
    await Promise.all([
      supabase
        .from("announcements")
        .select("id, title, created_at, emailed_at, show_banner_until")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("email_templates").select("*").order("key"),
      supabase
        .from("email_log")
        .select("id, to_email, subject, status, template_key, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl">Comunicados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Avise todas as membras de uma vez — por e-mail e banner no topo do
          app.
        </p>
      </div>

      <AnnouncementForm />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">Histórico de comunicados</h2>
        {!announcements?.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhum comunicado enviado ainda.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {announcements.map((announcement) => (
              <li key={announcement.id} className="px-4 py-2.5 text-sm">
                <p className="font-medium">{announcement.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(announcement.created_at)}
                  {announcement.emailed_at && " · enviado por e-mail"}
                  {announcement.show_banner_until &&
                    new Date(announcement.show_banner_until) > new Date() &&
                    " · banner ativo"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EmailTemplatesEditor templates={templates ?? []} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">Últimos e-mails enviados</h2>
        {!emailLog?.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhum e-mail registrado ainda.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {emailLog.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 px-4 py-2 text-xs"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{entry.to_email}</span> —{" "}
                  {entry.subject}
                </span>
                <span
                  className={
                    entry.status === "sent"
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                  }
                >
                  {entry.status}
                </span>
                <span className="text-muted-foreground">
                  {formatDateTime(entry.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
