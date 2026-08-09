import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl">Esqueci minha senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe o e-mail da sua assinatura. Enviaremos um link para você criar
          uma nova senha.
        </p>
      </div>
      <ResetForm />
      <Link
        href="/entrar"
        className="text-center text-sm text-muted-foreground underline underline-offset-4"
      >
        Voltar para o login
      </Link>
    </div>
  );
}
