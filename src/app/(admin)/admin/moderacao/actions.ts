"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function logModeration(
  actorId: string,
  action: string,
  targets: {
    userId?: string | null;
    postId?: string | null;
    commentId?: string | null;
  },
  metadata: Record<string, unknown> = {}
) {
  const supabase = await createClient();
  await supabase.from("moderation_log").insert({
    actor_id: actorId,
    action,
    target_user_id: targets.userId ?? null,
    target_post_id: targets.postId ?? null,
    target_comment_id: targets.commentId ?? null,
    metadata: metadata as never,
  });
}

function revalidate() {
  revalidatePath("/admin/moderacao");
}

export async function setCommentHidden(commentId: string, hidden: boolean) {
  const staff = await requireStaff();
  const supabase = await createClient();
  await supabase
    .from("comments")
    .update({
      hidden_at: hidden ? new Date().toISOString() : null,
      hidden_by: hidden ? staff.id : null,
    })
    .eq("id", commentId);
  await logModeration(staff.id, hidden ? "hide_comment" : "unhide_comment", {
    commentId,
  });
  revalidate();
}

export async function setCommentPinned(commentId: string, pinned: boolean) {
  const staff = await requireStaff();
  const supabase = await createClient();
  await supabase
    .from("comments")
    .update({ is_pinned: pinned })
    .eq("id", commentId);
  await logModeration(staff.id, pinned ? "pin_comment" : "unpin_comment", {
    commentId,
  });
  revalidate();
}

export async function moderatorDeleteComment(commentId: string) {
  const staff = await requireStaff();
  const supabase = await createClient();
  await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  await logModeration(staff.id, "delete_comment", { commentId });
  revalidate();
}

export async function muteMember(userId: string, days: number) {
  const staff = await requireStaff();
  const supabase = await createClient();
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await supabase
    .from("profiles")
    .update({ muted_until: until.toISOString() })
    .eq("id", userId);
  await logModeration(staff.id, "mute_member", { userId }, { days });
  revalidate();
}

export async function unmuteMember(userId: string) {
  const staff = await requireStaff();
  const supabase = await createClient();
  await supabase.from("profiles").update({ muted_until: null }).eq("id", userId);
  await logModeration(staff.id, "unmute_member", { userId });
  revalidate();
}

export async function banMember(userId: string) {
  const staff = await requireStaff();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ banned_at: new Date().toISOString() })
    .eq("id", userId);
  await logModeration(staff.id, "ban_member", { userId });
  revalidate();
  revalidatePath("/admin/membros");
}

export async function unbanMember(userId: string) {
  const staff = await requireStaff();
  const supabase = await createClient();
  await supabase.from("profiles").update({ banned_at: null }).eq("id", userId);
  await logModeration(staff.id, "unban_member", { userId });
  revalidate();
  revalidatePath("/admin/membros");
}

export async function resolveReport(
  reportId: string,
  resolution: "kept" | "removed"
) {
  const staff = await requireStaff();
  const supabase = await createClient();

  const { data: report } = await supabase
    .from("reports")
    .select("comment_id")
    .eq("id", reportId)
    .single();

  if (resolution === "removed" && report) {
    await supabase
      .from("comments")
      .update({ hidden_at: new Date().toISOString(), hidden_by: staff.id })
      .eq("id", report.comment_id);
  }

  await supabase
    .from("reports")
    .update({
      status: "resolved",
      resolved_by: staff.id,
      resolution:
        resolution === "removed" ? "Comentário ocultado" : "Comentário mantido",
    })
    .eq("id", reportId);

  await logModeration(
    staff.id,
    "resolve_report",
    { commentId: report?.comment_id },
    { resolution }
  );
  revalidate();
}
