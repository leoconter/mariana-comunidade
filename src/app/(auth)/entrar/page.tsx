import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  const { proximo, erro } = await searchParams;

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-3xl">Comunidade</h1>
        <p className="mt-1 font-heading text-lg text-primary">
          Mariana Valentina
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Entre com o e-mail da sua assinatura. Você vai receber um link de
          acesso — sem senha.
        </p>
      </div>
      {erro === "link-invalido" && (
        <p
          role="alert"
          className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Esse link de acesso expirou ou já foi usado. Peça um novo abaixo —
          lembre-se de abri-lo no mesmo aparelho em que pediu.
        </p>
      )}
      <SignInForm next={proximo ?? "/"} />
      <p className="text-center text-xs text-muted-foreground">
        Ao entrar, você concorda com os{" "}
        <a href="/termos" className="underline underline-offset-2">
          Termos de Uso
        </a>{" "}
        e a{" "}
        <a href="/privacidade" className="underline underline-offset-2">
          Política de Privacidade
        </a>
        .
      </p>
    </div>
  );
}
