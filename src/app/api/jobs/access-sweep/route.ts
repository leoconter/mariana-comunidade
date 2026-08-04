import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeAccessValidUntil } from "@/lib/kirvano";
import { sendTemplateEmail } from "@/lib/email";

/**
 * Nightly reconciliation: recompute access for everyone from the stored truth
 * (subscriptions + grants), expire past-due subscriptions whose grace ended
 * and canceled ones past the paid period. Idempotent.
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

  // Transition to expired + notify (once — the update filters repeat runs).
  const { data: newlyExpired } = await supabase
    .from("subscriptions")
    .update({ status: "expired" })
    .or(
      `and(status.eq.past_due,grace_until.lt.${nowIso}),and(status.eq.canceled,current_period_end.lt.${nowIso})`
    )
    .select("user_id, profiles(email, full_name)");

  // Recompute the denormalized access column for every member.
  const { data: members } = await supabase
    .from("profiles")
    .select("id")
    .neq("role", "admin");
  for (const member of members ?? []) {
    await recomputeAccessValidUntil(member.id);
  }

  for (const subscription of newlyExpired ?? []) {
    const profile = subscription.profiles;
    if (!profile?.email) continue;
    await sendTemplateEmail({
      templateKey: "access_expired",
      to: profile.email,
      userId: subscription.user_id,
      variables: {
        nome: (profile.full_name ?? "").split(" ")[0] || "colega",
        url_reativacao: process.env.KIRVANO_PAYMENT_URL ?? "",
      },
      related: { job: "access-sweep" },
    });
  }

  return NextResponse.json({
    ok: true,
    expired: newlyExpired?.length ?? 0,
    recomputed: members?.length ?? 0,
  });
}
