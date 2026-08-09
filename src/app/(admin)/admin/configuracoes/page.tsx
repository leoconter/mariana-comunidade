import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { WebhookSimulator } from "./webhook-simulator";

export const metadata: Metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  const simulatorEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_WEBHOOK_SIMULATOR === "true";

  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/webhooks/kirvano`;

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("kirvano_webhook_events")
    .select("id, event_type, processed_at, error, created_at, payload")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Integrações e ferramentas de teste. Os modelos de e-mail são editados
          em Comunicados.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Webhook da Kirvano</h2>
        <div className="rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">URL de integração</p>
          <code className="mt-1 block break-all rounded bg-muted px-2 py-1.5 text-xs">
            {webhookUrl}
          </code>
          <p className="mt-3 text-muted-foreground">
            Na Kirvano, cadastre essa URL e use o mesmo token de segurança
            definido na variável{" "}
            <code className="rounded bg-muted px-1 text-xs">
              KIRVANO_WEBHOOK_TOKEN
            </code>
            . Cada compra aprovada cria a conta da membra e dispara o e-mail
            com o link para ela criar a senha.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Eventos recebidos da Kirvano</h2>
        {!events?.length ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum evento recebido ainda. Assim que a Kirvano enviar o primeiro
            webhook, ele aparece aqui — inclusive se o formato não for
            reconhecido, para facilitar o ajuste.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {events.map((event) => {
              const ok = event.processed_at && !event.error;
              return (
                <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                  {ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : event.error ? (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : (
                    <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{event.event_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.created_at)}
                      {ok && " · acesso liberado"}
                      {!ok && !event.error && " · recebido, não processado"}
                    </p>
                    {event.error && (
                      <p className="mt-1 text-xs text-destructive">
                        {event.error}
                      </p>
                    )}
                    {event.error && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          Ver o que a Kirvano enviou
                        </summary>
                        <pre className="mt-1 max-h-52 overflow-auto rounded bg-muted p-2 text-[11px]">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {simulatorEnabled && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg">Simulador de assinatura</h2>
          <p className="text-sm text-muted-foreground">
            Dispara os mesmos eventos que a Kirvano enviaria, no mesmo código do
            webhook real. Use um e-mail de teste para percorrer o ciclo:
            ativação → falha de pagamento → expiração → reativação.
          </p>
          <WebhookSimulator />
        </section>
      )}
    </div>
  );
}
