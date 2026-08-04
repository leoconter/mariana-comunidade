"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

/**
 * Password sign-in — kept as a secondary path for admins/moderators.
 * Members use the magic link, which needs no password management.
 */
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

export async function signInWithMagicLink(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Informe um e-mail válido." };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? `https://${headerList.get("host")}`;

  const next = String(formData.get("next") ?? "/");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?proximo=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    if (error.status === 429) {
      return {
        status: "error",
        message: "Muitas tentativas. Aguarde um minuto e tente novamente.",
      };
    }
    return {
      status: "error",
      message: "Não foi possível enviar o link. Tente novamente.",
    };
  }

  return { status: "sent" };
}
