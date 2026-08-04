import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Membros" };

const STATUS_FILTERS = [
  { value: "todos", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "past_due", label: "Pendentes" },
  { value: "canceled", label: "Canceladas" },
  { value: "expired", label: "Expiradas" },
  { value: "cortesia", label: "Cortesia" },
];

const STATUS_BADGES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  active: { label: "Ativa", variant: "default" },
  past_due: { label: "Pendente", variant: "destructive" },
  canceled: { label: "Cancelada", variant: "secondary" },
  expired: { label: "Expirada", variant: "outline" },
};

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "todos" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, banned_at, last_seen_at, created_at, access_valid_until, subscriptions(status, plan), access_grants!access_grants_user_id_fkey(id, revoked_at)"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (q.trim()) {
    query = query.or(`full_name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`);
  }
  const { data: profiles } = await query;

  const filtered = (profiles ?? []).filter((profile) => {
    if (status === "todos") return true;
    if (status === "cortesia")
      return profile.access_grants.some((g) => !g.revoked_at);
    return profile.subscriptions?.status === status;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl">Membros</h1>
        <Button variant="outline" size="sm" asChild>
          {/* Plain <a>: this is a file download served by a route handler. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/admin/membros/export">
            <Download className="size-4" /> Exportar CSV
          </a>
        </Button>
      </div>

      <form action="/admin/membros" className="flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou e-mail..."
          className="max-w-xs"
        />
        <input type="hidden" name="status" value={status} />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      <div className="flex gap-1 overflow-x-auto">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={`/admin/membros?status=${filter.value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-sm",
              status === filter.value
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhuma membra encontrada. As assinantes aparecem aqui automaticamente
          quando a Kirvano confirma o pagamento.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {filtered.map((profile) => {
            const hasGrant = profile.access_grants.some((g) => !g.revoked_at);
            const badge = profile.subscriptions
              ? STATUS_BADGES[profile.subscriptions.status]
              : null;
            return (
              <li key={profile.id}>
                <Link
                  href={`/admin/membros/${profile.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {profile.full_name || profile.email}
                      {profile.role !== "member" && (
                        <span className="ml-2 text-xs text-primary">
                          {profile.role === "admin" ? "Admin" : "Moderadora"}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {profile.email} · entrou {formatDate(profile.created_at)}
                      {profile.last_seen_at &&
                        ` · visto ${formatDate(profile.last_seen_at)}`}
                    </p>
                  </div>
                  {profile.banned_at && (
                    <Badge variant="destructive">Banida</Badge>
                  )}
                  {hasGrant && <Badge variant="secondary">Cortesia</Badge>}
                  {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
