"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = {
  status: "idle" | "error";
  message?: string;
};

export async function signInWithPassword(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { status: "error", message: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      status: "error",
      message:
        error.status === 400
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente novamente.",
    };
  }

  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") ? next : "/");
}
