import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { missingSupabaseEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Configuração necessária" };

/**
 * Shown (via proxy rewrite) when the deployment has no Supabase credentials.
 * Must not import any Supabase client — this is the page that explains why
 * those clients cannot be created.
 */
export default function ConfigurationNeededPage() {
  const missing = missingSupabaseEnv();

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-4 py-10">
      <div className="flex items-center gap-3">
        <TriangleAlert className="size-7 text-primary" />
        <h1 className="text-2xl">Configuração necessária</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        A comunidade está no ar, mas ainda não recebeu as credenciais do banco
        de dados. Nenhuma pessoa consegue entrar até que isso seja resolvido —
        e isso leva dois minutos.
      </p>

      {missing.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">Variáveis ausentes:</p>
          <ul className="mt-2 flex flex-col gap-1">
            {missing.map((name) => (
              <li key={name}>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  {name}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 text-sm">
        <p className="font-medium">Como resolver na Vercel</p>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-4 text-muted-foreground">
          <li>Abra o projeto → Settings → Environment Variables.</li>
          <li>
            Adicione as variáveis acima (os valores estão no arquivo{" "}
            <code className="rounded bg-muted px-1 text-xs">.env.local</code> da
            sua máquina).
          </li>
          <li>
            <strong className="text-foreground">
              Faça um novo deploy depois de salvar.
            </strong>{" "}
            Só adicionar a variável não conserta um build que já subiu — os
            valores são embutidos durante a construção.
          </li>
        </ol>
      </div>
    </main>
  );
}
