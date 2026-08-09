"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createPasswordSetupLink } from "@/lib/auth-links";
import { sendTemplateEmail } from "@/lib/email";

export type ResetState = { status: "idle" | "sent" | "error"; message?: string };

/** Our own email (Resend + our link) needs both of these configured. */
function canSendOwnEmail(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.RESEND_API_KEY &&
      process.env.EMAIL_FROM
  );
}

export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Informe um e-mail válido." };
  }

  if (canSendOwnEmail()) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("email", email)
      .maybeSingle();

    // Always answer "sent" so the form cannot be used to discover which
    // e-mails have an account.
    if (profile) {
      const link = await createPasswordSetupLink(email);
      if (link) {
        await sendTemplateEmail({
          templateKey: "password_setup",
          to: email,
          userId: profile.id,
          variables: {
            nome: (profile.full_name ?? "").split(" ")[0] || "colega",
            url_senha: link,
          },
          related: { flow: "password_reset" },
        });
      }
    }
    return { status: "sent" };
  }

  // Fallback: let Supabase send its own recovery email. Works without the
  // service-role key and without Resend, at the cost of depending on the
  // project's Site URL / redirect allow list.
  const supabase = await createClient();
  const headerList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? `https://${headerList.get("host")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?proximo=${encodeURIComponent("/nova-senha")}`,
  });

  if (error && error.status !== 422) {
    return {
      status: "error",
      message: "Não foi possível enviar agora. Tente novamente em instantes.",
    };
  }
  return { status: "sent" };
}
