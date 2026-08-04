import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateEmail } from "@/lib/email";

/**
 * Email side of publishing (in-app notifications are inserted by the
 * pg_cron SQL sweep). Sends the "new post" email to followers of the space
 * and stamps notified_at. Idempotent.
 */
export async function POST(request: NextRequest) {
  if (
    !process.env.JOBS_SECRET ||
    request.headers.get("x-jobs-secret") !== process.env.JOBS_SECRET
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, space_id, spaces(name, emoji, slug)")
    .eq("status", "published")
    .eq("notify_members", true)
    .is("notified_at", null)
    .limit(20);

  let sent = 0;
  for (const post of posts ?? []) {
    // Stamp first: a crash cannot re-email on the next run.
    await supabase
      .from("posts")
      .update({ notified_at: nowIso })
      .eq("id", post.id);

    const { data: followers } = await supabase
      .from("profiles")
      .select("id, email, full_name, space_memberships!inner(space_id, notify)")
      .eq("space_memberships.space_id", post.space_id)
      .eq("space_memberships.notify", "all")
      .is("banned_at", null)
      .gt("access_valid_until", nowIso);

    for (const follower of followers ?? []) {
      await sendTemplateEmail({
        templateKey: "new_post",
        to: follower.email,
        userId: follower.id,
        variables: {
          titulo: post.title,
          espaco: `${post.spaces?.emoji ?? ""} ${post.spaces?.name ?? ""}`.trim(),
          url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/e/${post.spaces?.slug}/p/${post.id}`,
        },
        related: { post_id: post.id, job: "publish-sweep" },
      });
      sent += 1;
    }
  }

  return NextResponse.json({ ok: true, posts: posts?.length ?? 0, sent });
}
