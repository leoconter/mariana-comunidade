import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Assinatura" };

const STATUS_INFO: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  active: { label: "Ativa", variant: "default" },
  past_due: { label: "Pagamento pendente", variant: "destructive" },
  canceled: { label: "Cancelada", variant: "secondary" },
  expired: { label: "Expirada", variant: "outline" },
};

const PLAN_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
};

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: subscription }, { data: grants }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase
      .from("access_grants")
      .select("expires_at, reason")
      .eq("user_id", user!.id)
      .is("revoked_at", null),
  ]);

  const status = subscription ? STATUS_INFO[subscription.status] : null;

  return (
    <div className="flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl">Minha assinatura</h1>

      {subscription ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Plano {PLAN_LABELS[subscription.plan ?? ""] ?? "—"}
            </p>
            {status && <Badge variant={status.variant}>{status.label}</Badge>}
          </div>
          {subscription.current_period_end && (
            <p className="text-sm text-muted-foreground">
              {subscription.status === "canceled"
                ? "Acesso garantido até"
                : "Período pago até"}
              : {formatDate(subscription.current_period_end)}
            </p>
          )}
          {subscription.status === "past_due" && subscription.grace_until && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Regularize o pagamento até{" "}
              <strong>{formatDate(subscription.grace_until)}</strong> para não
              perder o acesso.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Pagamentos, troca de cartão e cancelamento são feitos pela Kirvano,
            nossa plataforma de pagamento. Qualquer dúvida, fale com o suporte.
          </p>
        </div>
      ) : (grants ?? []).length > 0 ? (
        <div className="rounded-xl border bg-card p-4 text-sm">
          Você tem <strong>acesso cortesia</strong>
          {grants![0].expires_at
            ? ` até ${formatDate(grants![0].expires_at)}`
            : " por tempo indeterminado"}
          . Aproveite! 💛
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Não encontramos uma assinatura vinculada a este e-mail.
        </p>
      )}
    </div>
  );
}
