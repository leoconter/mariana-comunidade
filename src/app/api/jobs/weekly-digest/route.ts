import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateEmail } from "@/lib/email";

/** Weekly digest of last week's posts to members who opted in. */
export async function POST(request: NextRequest) {
  if (
    !process.env.JOBS_SECRET ||
    request.headers.get("x-jobs-secret") !== process.env.JOBS_SECRET
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, spaces(name, emoji, slug)")
    .eq("status", "published")
    .gte("published_at", weekAgo)
    .order("published_at", { ascending: false })
    .limit(20);

  if (!posts?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no posts" });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const listHtml = `<ul>${posts
    .map(
      (post) =>
        `<li><a href="${siteUrl}/e/${post.spaces?.slug}/p/${post.id}">${post.spaces?.emoji ?? ""} ${post.title}</a></li>`
    )
    .join("")}</ul>`;

  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, full_name, email_prefs")
    .is("banned_at", null)
    .gt("access_valid_until", nowIso);

  let sent = 0;
  for (const member of members ?? []) {
    const prefs = (member.email_prefs ?? {}) as { digest?: boolean };
    if (prefs.digest === false) continue;
    await sendTemplateEmail({
      templateKey: "weekly_digest",
      to: member.email,
      userId: member.id,
      variables: {
        nome: (member.full_name ?? "").split(" ")[0] || "colega",
        lista_posts: listHtml,
        url: siteUrl,
      },
      related: { job: "weekly-digest" },
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
