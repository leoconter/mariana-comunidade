import type { Metadata } from "next";
import { WebhookSimulator } from "./webhook-simulator";

export const metadata: Metadata = { title: "Configurações" };

export default function AdminSettingsPage() {
  const simulatorEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_WEBHOOK_SIMULATOR === "true";

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
          <p>
            Configure na Kirvano o webhook apontando para{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/kirvano
            </code>{" "}
            com o token de segurança igual à variável{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              KIRVANO_WEBHOOK_TOKEN
            </code>
            .
          </p>
        </div>
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
