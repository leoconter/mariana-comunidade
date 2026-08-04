"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

async function currentUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticada.");
  return user.id;
}

export async function setFollowSpace(spaceId: string, following: boolean) {
  const userId = await currentUserId();
  const supabase = await createClient();
  await supabase.from("space_memberships").upsert(
    {
      space_id: spaceId,
      user_id: userId,
      following,
      notify: following ? "all" : "none",
    },
    { onConflict: "space_id,user_id" }
  );
  revalidatePath("/");
}

export async function setSavedPost(postId: string, saved: boolean) {
  const userId = await currentUserId();
  const supabase = await createClient();
  if (saved) {
    await supabase
      .from("saved_posts")
      .upsert({ post_id: postId, user_id: userId });
  } else {
    await supabase
      .from("saved_posts")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
  }
  revalidatePath("/salvos");
}

export async function markPostSeen(postId: string) {
  const userId = await currentUserId();
  const supabase = await createClient();
  await supabase.from("post_views").upsert(
    {
      post_id: postId,
      user_id: userId,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,post_id" }
  );
}

export type CommentResult = { ok: boolean; message?: string };

export async function updateOwnProfile(input: {
  fullName: string;
  city: string;
  state: string;
  crefito: string;
  yearsExperience: number | null;
  bio: string;
  directoryVisible: boolean;
  emailDigest: boolean;
  emailAnnouncements: boolean;
}): Promise<CommentResult> {
  const userId = await currentUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName.trim(),
      city: input.city.trim() || null,
      state: input.state.trim().toUpperCase().slice(0, 2) || null,
      crefito: input.crefito.trim() || null,
      years_experience: input.yearsExperience,
      bio: input.bio.trim() || null,
      directory_visible: input.directoryVisible,
      email_prefs: {
        digest: input.emailDigest,
        announcements: input.emailAnnouncements,
      },
    })
    .eq("id", userId);
  if (error) return { ok: false, message: "Não foi possível salvar o perfil." };
  revalidatePath("/perfil");
  return { ok: true };
}

export async function addComment(
  postId: string,
  body: string,
  parentId: string | null
): Promise<CommentResult> {
  const userId = await currentUserId();
  const supabase = await createClient();
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: "Escreva um comentário." };
  if (trimmed.length > 5000)
    return { ok: false, message: "Comentário longo demais." };

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: userId,
    parent_id: parentId,
    body: trimmed,
  });
  if (error) {
    // Trigger guards raise readable pt-BR messages (closed, muted, 1-level).
    return {
      ok: false,
      message: error.message.includes("encerrados")
        ? "Os comentários deste post estão encerrados."
        : error.message.includes("impedida")
          ? "Você está temporariamente impedida de comentar."
          : "Não foi possível enviar o comentário.",
    };
  }
  return { ok: true };
}

export async function deleteOwnComment(commentId: string) {
  const userId = await currentUserId();
  const supabase = await createClient();
  await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("author_id", userId);
}

export async function togglePostReaction(postId: string, reacted: boolean) {
  const userId = await currentUserId();
  const supabase = await createClient();
  if (reacted) {
    await supabase
      .from("reactions")
      .upsert(
        { post_id: postId, user_id: userId },
        { onConflict: "user_id,post_id", ignoreDuplicates: true }
      );
  } else {
    await supabase
      .from("reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
  }
}

export async function toggleCommentReaction(
  commentId: string,
  reacted: boolean
) {
  const userId = await currentUserId();
  const supabase = await createClient();
  if (reacted) {
    await supabase
      .from("reactions")
      .upsert(
        { comment_id: commentId, user_id: userId },
        { onConflict: "user_id,comment_id", ignoreDuplicates: true }
      );
  } else {
    await supabase
      .from("reactions")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);
  }
}

export async function reportComment(
  commentId: string,
  reason: string
): Promise<CommentResult> {
  const userId = await currentUserId();
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    comment_id: commentId,
    reporter_id: userId,
    reason: reason.trim() || null,
  });
  if (error)
    return { ok: false, message: "Não foi possível enviar a denúncia." };
  return { ok: true };
}

/** Records ToS + privacy consent once (called on first authenticated load). */
export async function recordBaseConsents() {
  const userId = await currentUserId();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("consents")
    .select("kind")
    .eq("user_id", userId)
    .in("kind", ["tos", "privacy"]);
  const kinds = new Set((existing ?? []).map((c) => c.kind));
  const missing = (["tos", "privacy"] as const).filter((k) => !kinds.has(k));
  if (missing.length > 0) {
    await supabase
      .from("consents")
      .insert(missing.map((kind) => ({ user_id: userId, kind, doc_version: "v1" })));
  }
}

/**
 * LGPD account deletion: removes the auth user; every owned row cascades
 * (profile, comments, submissions, consents, progress). Irreversible.
 */
export async function deleteOwnAccount() {
  const userId = await currentUserId();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (profile?.role === "admin") {
    throw new Error("Contas de administradora não podem se autoexcluir.");
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error("Não foi possível excluir a conta.");
  redirect("/entrar");
}

export async function rsvpEvent(eventId: string, going: boolean) {
  const userId = await currentUserId();
  const supabase = await createClient();
  await supabase.from("event_rsvps").upsert(
    {
      event_id: eventId,
      user_id: userId,
      status: going ? "going" : "declined",
    },
    { onConflict: "event_id,user_id" }
  );
  revalidatePath("/e", "layout");
}

export type CaseSubmissionInput = {
  eventId: string;
  chiefComplaint: string;
  history: string;
  assessment: string;
  question: string;
  consentAccepted: boolean;
};

export async function submitCase(
  input: CaseSubmissionInput
): Promise<CommentResult> {
  const userId = await currentUserId();
  const supabase = await createClient();

  if (!input.consentAccepted) {
    return {
      ok: false,
      message:
        "É obrigatório confirmar que o caso não contém dados que identifiquem a paciente.",
    };
  }
  if (!input.chiefComplaint.trim() || !input.question.trim()) {
    return {
      ok: false,
      message: "Preencha ao menos a queixa principal e a dúvida para discussão.",
    };
  }

  const { data: consent, error: consentError } = await supabase
    .from("consents")
    .insert({
      user_id: userId,
      kind: "case_health_data",
      doc_version: "v1",
    })
    .select("id")
    .single();
  if (consentError || !consent) {
    return { ok: false, message: "Não foi possível registrar o consentimento." };
  }

  const { error } = await supabase.from("case_submissions").insert({
    event_id: input.eventId,
    user_id: userId,
    consent_id: consent.id,
    payload: {
      chief_complaint: input.chiefComplaint.trim(),
      history: input.history.trim(),
      assessment: input.assessment.trim(),
      question: input.question.trim(),
    },
  });
  if (error) {
    return { ok: false, message: "Não foi possível enviar o caso." };
  }
  return { ok: true };
}

export async function saveMediaProgress(
  mediaId: string,
  seconds: number,
  completed: boolean
) {
  const userId = await currentUserId();
  const supabase = await createClient();
  await supabase.from("media_progress").upsert(
    {
      media_id: mediaId,
      user_id: userId,
      seconds: Math.max(0, Math.floor(seconds)),
      completed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,media_id" }
  );
}
