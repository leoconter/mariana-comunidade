"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type NewPasswordState = { status: "idle" | "error"; message?: string };

export async function setNewPassword(
  _prev: NewPasswordState,
  formData: FormData
): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirmation") ?? "");

  if (password.length < 8) {
    return { status: "error", message: "A senha precisa ter ao menos 8 caracteres." };
  }
  if (password !== confirmation) {
    return { status: "error", message: "As senhas não conferem." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      status: "error",
      message: "Seu link expirou. Peça um novo em “Esqueci minha senha”.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      status: "error",
      message: "Não foi possível salvar a senha. Tente novamente.",
    };
  }

  redirect("/");
}
