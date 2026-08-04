import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** LGPD data portability: everything the platform stores about the member. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [profile, subscription, grants, consents, comments, saved, views, progress, rsvps, cases, reports] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("access_grants").select("*").eq("user_id", user.id),
      supabase.from("consents").select("*").eq("user_id", user.id),
      supabase.from("comments").select("*").eq("author_id", user.id),
      supabase.from("saved_posts").select("*").eq("user_id", user.id),
      supabase.from("post_views").select("*").eq("user_id", user.id),
      supabase.from("media_progress").select("*").eq("user_id", user.id),
      supabase.from("event_rsvps").select("*").eq("user_id", user.id),
      supabase.from("case_submissions").select("*").eq("user_id", user.id),
      supabase.from("reports").select("*").eq("reporter_id", user.id),
    ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    subscription: subscription.data,
    access_grants: grants.data,
    consents: consents.data,
    comments: comments.data,
    saved_posts: saved.data,
    post_views: views.data,
    media_progress: progress.data,
    event_rsvps: rsvps.data,
    case_submissions: cases.data,
    reports: reports.data,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
