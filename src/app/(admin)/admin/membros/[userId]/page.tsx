import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { MemberDetailActions } from "./member-detail-actions";

export const metadata: Metadata = { title: "Membro" };

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "*, subscriptions(*), access_grants!access_grants_user_id_fkey(id, reason, expires_at, revoked_at, created_at)"
    )
    .eq("id", userId)
    .single();

  if (!profile) notFound();

  const activeGrants = profile.access_grants.filter((g) => !g.revoked_at);
  const hasAccess =
    profile.access_valid_until &&
    new Date(profile.access_valid_until) > new Date();

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/admin/membros">
            <ArrowLeft className="size-4" /> Membros
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl">{profile.full_name || profile.email}</h1>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant={hasAccess ? "default" : "outline"}>
            {hasAccess
              ? `Acesso até ${formatDate(profile.access_valid_until!)}`
              : "Sem acesso"}
          </Badge>
          {profile.banned_at && <Badge variant="destructive">Banida</Badge>}
          {profile.muted_until &&
            new Date(profile.muted_until) > new Date() && (
              <Badge variant="secondary">
                Silenciada até {formatDate(profile.muted_until)}
              </Badge>
            )}
        </div>
      </div>

      <section className="rounded-xl border bg-card p-4 text-sm">
        <h2 className="mb-2 font-medium">Perfil</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
          <dt>Cidade/UF</dt>
          <dd>
            {profile.city || "—"}
            {profile.state ? `/${profile.state}` : ""}
          </dd>
          <dt>CREFITO</dt>
          <dd>{profile.crefito || "—"}</dd>
          <dt>Entrou em</dt>
          <dd>{formatDate(profile.created_at)}</dd>
          <dt>Último acesso</dt>
          <dd>
            {profile.last_seen_at ? formatDateTime(profile.last_seen_at) : "—"}
          </dd>
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-4 text-sm">
        <h2 className="mb-2 font-medium">Assinatura (Kirvano)</h2>
        {profile.subscriptions ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
            <dt>Status</dt>
            <dd>{profile.subscriptions.status}</dd>
            <dt>Plano</dt>
            <dd>{profile.subscriptions.plan ?? "—"}</dd>
            <dt>Período pago até</dt>
            <dd>
              {profile.subscriptions.current_period_end
                ? formatDate(profile.subscriptions.current_period_end)
                : "—"}
            </dd>
            {profile.subscriptions.grace_until && (
              <>
                <dt>Carência até</dt>
                <dd>{formatDate(profile.subscriptions.grace_until)}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-muted-foreground">
            Nenhuma assinatura vinculada a este e-mail.
          </p>
        )}
      </section>

      <MemberDetailActions
        userId={profile.id}
        email={profile.email}
        fullName={profile.full_name}
        role={profile.role as "member" | "moderator" | "admin"}
        grants={activeGrants}
        muted={Boolean(
          profile.muted_until && new Date(profile.muted_until) > new Date()
        )}
        banned={Boolean(profile.banned_at)}
      />
    </div>
  );
}
