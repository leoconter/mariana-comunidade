import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Criar senha" };

export default async function NewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Reached through the recovery link, which already established a session.
  if (!user) redirect("/entrar?erro=link-invalido");

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl">Criar sua senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha uma senha para {user.email}. Você vai usá-la para entrar na
          comunidade.
        </p>
      </div>
      <NewPasswordForm />
    </div>
  );
}
