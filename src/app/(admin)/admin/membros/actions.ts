"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createPasswordSetupLink } from "@/lib/auth-links";
import { sendTemplateEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { recomputeAccessValidUntil } from "@/lib/kirvano";

export type MemberActionResult = { ok: boolean; message?: string };

function revalidateMember(userId: string) {
  revalidatePath("/admin/membros");
  revalidatePath(`/admin/membros/${userId}`);
}

export async function setMemberRole(
  userId: string,
  role: "member" | "moderator" | "admin"
): Promise<MemberActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.id && role !== "admin") {
    return { ok: false, message: "Você não pode remover seu próprio papel de admin." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { ok: false, message: "Não foi possível alterar o papel." };
  revalidateMember(userId);
  return { ok: true };
}

export async function grantAccess(
  userId: string,
  expiresAt: string | null,
  reason: string
): Promise<MemberActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("access_grants").insert({
    user_id: userId,
    granted_by: admin.id,
    expires_at: expiresAt,
    reason: reason.trim() || null,
  });
  if (error) return { ok: false, message: "Não foi possível conceder o acesso." };
  await recomputeAccessValidUntil(userId);
  revalidateMember(userId);
  return { ok: true };
}

export async function revokeGrant(
  grantId: string,
  userId: string
): Promise<MemberActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("access_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId);
  if (error) return { ok: false, message: "Não foi possível revogar." };
  await recomputeAccessValidUntil(userId);
  revalidateMember(userId);
  return { ok: true };
}

/** Sends the "create your password" link — used for members who never set one. */
export async function sendPasswordSetupLink(
  email: string,
  userId: string
): Promise<MemberActionResult> {
  await requireAdmin();

  const link = await createPasswordSetupLink(email);
  if (!link) {
    return { ok: false, message: "Não foi possível gerar o link de senha." };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  await sendTemplateEmail({
    templateKey: "password_setup",
    to: email,
    userId,
    variables: {
      nome: (profile?.full_name ?? "").split(" ")[0] || "colega",
      url_senha: link,
    },
    related: { flow: "admin_password_setup" },
  });

  return { ok: true, message: `Link de senha enviado para ${email}.` };
}

export async function updateMemberName(
  userId: string,
  fullName: string
): Promise<MemberActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName.trim() })
    .eq("id", userId);
  if (error) return { ok: false, message: "Não foi possível salvar." };
  revalidateMember(userId);
  return { ok: true };
}
