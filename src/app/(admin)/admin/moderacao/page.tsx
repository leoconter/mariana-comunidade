import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CommentModerationRow, ReportRow } from "./moderation-rows";

export const metadata: Metadata = { title: "Moderação" };

const TABS = [
  { value: "comentarios", label: "Comentários" },
  { value: "denuncias", label: "Denúncias" },
  { value: "log", label: "Histórico" },
];

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const { aba = "comentarios" } = await searchParams;
  const supabase = await createClient();

  const [{ data: comments }, { data: reports, count: openReports }, { data: log }] =
    await Promise.all([
      supabase
        .from("comments")
        .select(
          "id, body, created_at, hidden_at, is_pinned, deleted_at, author:profiles!comments_author_id_fkey(id, full_name, muted_until, banned_at), posts(id, title, spaces(slug))"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("reports")
        .select(
          "id, reason, status, created_at, resolution, comments(id, body, author:profiles!comments_author_id_fkey(full_name)), reporter:profiles!reports_reporter_id_fkey(full_name)",
          { count: "exact" }
        )
        .eq("status", "open")
        .order("created_at", { ascending: false }),
      supabase
        .from("moderation_log")
        .select("id, action, created_at, metadata, actor:profiles!moderation_log_actor_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl">Moderação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os comentários da plataforma num só lugar.
        </p>
      </div>

      <div className="flex gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/moderacao?aba=${tab.value}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm",
              aba === tab.value
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {tab.label}
            {tab.value === "denuncias" && (openReports ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-xs text-white">
                {openReports}
              </span>
            )}
          </Link>
        ))}
      </div>

      {aba === "comentarios" && (
        <ul className="divide-y rounded-xl border bg-card">
          {!comments?.length ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum comentário ainda.
            </li>
          ) : (
            comments.map((comment) => (
              <CommentModerationRow key={comment.id} comment={comment} />
            ))
          )}
        </ul>
      )}

      {aba === "denuncias" && (
        <ul className="divide-y rounded-xl border bg-card">
          {!reports?.length ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhuma denúncia aberta. 🎉
            </li>
          ) : (
            reports.map((report) => <ReportRow key={report.id} report={report} />)
          )}
        </ul>
      )}

      {aba === "log" && (
        <ul className="divide-y rounded-xl border bg-card">
          {!log?.length ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhuma ação registrada.
            </li>
          ) : (
            log.map((entry) => (
              <li key={entry.id} className="px-4 py-2.5 text-sm">
                <span className="font-medium">
                  {entry.actor?.full_name ?? "Sistema"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {ACTION_LABELS[entry.action] ?? entry.action} ·{" "}
                  {formatDateTime(entry.created_at)}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  hide_comment: "ocultou um comentário",
  unhide_comment: "reexibiu um comentário",
  pin_comment: "fixou um comentário",
  unpin_comment: "desafixou um comentário",
  delete_comment: "excluiu um comentário",
  mute_member: "silenciou uma membra",
  unmute_member: "removeu o silêncio de uma membra",
  ban_member: "baniu uma membra",
  unban_member: "removeu o banimento de uma membra",
  resolve_report: "resolveu uma denúncia",
};
