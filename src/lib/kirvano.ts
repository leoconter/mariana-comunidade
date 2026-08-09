import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPasswordSetupLink } from "@/lib/auth-links";
import { sendTemplateEmail } from "@/lib/email";

/**
 * Normalized internal event set. The raw Kirvano event names are mapped in
 * `normalizeKirvanoEvent` — ADJUST THAT TABLE when the real webhook docs
 * (payload samples) are wired in. Everything downstream is stable.
 */
export type KirvanoEventKind =
  | "activated"
  | "renewed"
  | "payment_failed"
  | "canceled"
  | "reactivated";

export type NormalizedKirvanoEvent = {
  externalEventId: string;
  kind: KirvanoEventKind;
  email: string;
  fullName?: string;
  plan: "monthly" | "quarterly" | "annual" | null;
  customerId?: string;
  subscriptionId?: string;
  /** End of the paid period, if the payload provides one. */
  periodEnd?: string;
  rawPayload: unknown;
  rawEventType: string;
};

const GRACE_DAYS = 5;
const RENEWAL_SLACK_HOURS = 24;

/** Map raw Kirvano event names → internal kinds. Adjust against real docs. */
const EVENT_MAP: Record<string, KirvanoEventKind> = {
  SALE_APPROVED: "activated",
  SUBSCRIPTION_ACTIVATED: "activated",
  SUBSCRIPTION_RENEWED: "renewed",
  RECURRING_SALE_APPROVED: "renewed",
  SUBSCRIPTION_LATE: "payment_failed",
  SALE_REFUSED: "payment_failed",
  PAYMENT_FAILED: "payment_failed",
  SUBSCRIPTION_CANCELED: "canceled",
  SALE_REFUNDED: "canceled",
  SALE_CHARGEBACK: "canceled",
  SUBSCRIPTION_REACTIVATED: "reactivated",
};

export function mapPlanName(
  raw: string | undefined | null
): NormalizedKirvanoEvent["plan"] {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("anual") || lower.includes("annual")) return "annual";
  if (lower.includes("trimestral") || lower.includes("quarter"))
    return "quarterly";
  if (lower.includes("mensal") || lower.includes("month")) return "monthly";
  return null;
}

function planMonths(plan: NormalizedKirvanoEvent["plan"]): number {
  if (plan === "annual") return 12;
  if (plan === "quarterly") return 3;
  return 1;
}

/**
 * Parse the raw Kirvano webhook body into a normalized event.
 * Defensive: works with the commonly documented shape
 * { event, event_description, checkout_id/sale_id, customer: {email, name},
 *   plan: {name, next_charge_date}, ... } — adjust when real samples arrive.
 */
export function normalizeKirvanoEvent(
  payload: Record<string, unknown>
): NormalizedKirvanoEvent | null {
  const rawEventType = String(
    payload.event ?? payload.event_type ?? payload.type ?? ""
  ).toUpperCase();
  const kind = EVENT_MAP[rawEventType];
  if (!kind) return null;

  const customer = (payload.customer ?? {}) as Record<string, unknown>;
  const email = String(customer.email ?? payload.email ?? "")
    .trim()
    .toLowerCase();
  if (!email) return null;

  const plan = (payload.plan ?? {}) as Record<string, unknown>;
  const products = Array.isArray(payload.products)
    ? (payload.products as Record<string, unknown>[])
    : [];
  const planName =
    (plan.name as string | undefined) ??
    (products[0]?.offer_name as string | undefined) ??
    (products[0]?.name as string | undefined);

  const externalEventId = String(
    payload.event_id ??
      payload.id ??
      payload.sale_id ??
      payload.checkout_id ??
      `${rawEventType}:${email}:${payload.created_at ?? Date.now()}`
  );

  const periodEndRaw =
    (plan.next_charge_date as string | undefined) ??
    (payload.next_charge_date as string | undefined) ??
    (payload.expires_at as string | undefined);

  return {
    externalEventId,
    kind,
    email,
    fullName: (customer.name as string | undefined) ?? undefined,
    plan: mapPlanName(planName),
    customerId: (customer.id as string | undefined) ?? undefined,
    subscriptionId:
      (payload.subscription_id as string | undefined) ??
      (payload.sale_id as string | undefined) ??
      undefined,
    periodEnd:
      periodEndRaw && !Number.isNaN(Date.parse(periodEndRaw))
        ? new Date(periodEndRaw).toISOString()
        : undefined,
    rawPayload: payload,
    rawEventType,
  };
}

/** Applies a normalized event: user provisioning, subscription state, access. */
export async function processKirvanoEvent(
  event: NormalizedKirvanoEvent
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const supabase = createAdminClient();

  // Idempotency: record first; a duplicate external id means already handled.
  const { error: logError } = await supabase.from("kirvano_webhook_events").insert({
    external_event_id: event.externalEventId,
    event_type: event.rawEventType,
    payload: event.rawPayload as never,
  });
  if (logError?.code === "23505") return { ok: true, skipped: true };

  try {
    // 1. Find or create the user by email.
    let { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, access_valid_until")
      .eq("email", event.email)
      .maybeSingle();

    if (!profile) {
      const { data: created, error: createError } =
        await supabase.auth.admin.createUser({
          email: event.email,
          email_confirm: true,
          user_metadata: { full_name: event.fullName ?? "" },
        });
      if (createError || !created.user) throw new Error("createUser failed");
      const { data: newProfile } = await supabase
        .from("profiles")
        .select("id, full_name, access_valid_until")
        .eq("id", created.user.id)
        .single();
      profile = newProfile;
    }
    if (!profile) throw new Error("profile not found");

    // 2. Apply the subscription transition.
    const now = new Date();
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle();

    const fallbackPeriodEnd = new Date(now);
    fallbackPeriodEnd.setMonth(
      fallbackPeriodEnd.getMonth() + planMonths(event.plan)
    );
    const periodEnd =
      event.periodEnd ?? fallbackPeriodEnd.toISOString();

    let next: {
      status: string;
      current_period_end: string | null;
      grace_until: string | null;
      canceled_at: string | null;
    };

    switch (event.kind) {
      case "activated":
      case "reactivated":
      case "renewed":
        next = {
          status: "active",
          current_period_end: periodEnd,
          grace_until: null,
          canceled_at: null,
        };
        break;
      case "payment_failed": {
        const grace = new Date(now.getTime() + GRACE_DAYS * 24 * 3600 * 1000);
        next = {
          status: "past_due",
          current_period_end:
            subscription?.current_period_end ?? periodEnd,
          grace_until: grace.toISOString(),
          canceled_at: subscription?.canceled_at ?? null,
        };
        break;
      }
      case "canceled":
        next = {
          status: "canceled",
          current_period_end:
            subscription?.current_period_end ?? now.toISOString(),
          grace_until: null,
          canceled_at: now.toISOString(),
        };
        break;
    }

    await supabase.from("subscriptions").upsert(
      {
        user_id: profile.id,
        kirvano_customer_id: event.customerId ?? subscription?.kirvano_customer_id,
        kirvano_subscription_id:
          event.subscriptionId ?? subscription?.kirvano_subscription_id,
        plan: event.plan ?? subscription?.plan,
        ...next,
        last_event_at: now.toISOString(),
      },
      { onConflict: "user_id" }
    );

    // 3. Recompute the denormalized access column.
    await recomputeAccessValidUntil(profile.id);

    // 4. Side-effect emails.
    const firstName = (event.fullName ?? profile.full_name ?? "").split(" ")[0];
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    if (event.kind === "activated" || event.kind === "reactivated") {
      // Accounts provisioned here have no password yet, so the welcome email
      // carries the link that lets her create one (falls back to the login
      // page for people who already have an account).
      const passwordLink = await createPasswordSetupLink(event.email);
      await sendTemplateEmail({
        templateKey: "welcome",
        to: event.email,
        userId: profile.id,
        variables: {
          nome: firstName || "colega",
          url: passwordLink ?? `${siteUrl}/entrar`,
        },
        related: { event: event.rawEventType },
      });
    } else if (event.kind === "payment_failed" && next.grace_until) {
      await sendTemplateEmail({
        templateKey: "payment_failed",
        to: event.email,
        userId: profile.id,
        variables: {
          nome: firstName || "colega",
          data_limite: new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
          }).format(new Date(next.grace_until)),
          url_pagamento: process.env.KIRVANO_PAYMENT_URL ?? siteUrl,
        },
        related: { event: event.rawEventType },
      });
    }

    await supabase
      .from("kirvano_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("external_event_id", event.externalEventId);

    return { ok: true };
  } catch (error) {
    await supabase
      .from("kirvano_webhook_events")
      .update({ error: error instanceof Error ? error.message : "unknown" })
      .eq("external_event_id", event.externalEventId);
    return { ok: false, error: "processing failed" };
  }
}

/**
 * access_valid_until = greatest(subscription-derived deadline, active manual
 * grants). Called by the webhook and by the nightly access sweep.
 */
export async function recomputeAccessValidUntil(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const [{ data: subscription }, { data: grants }, { data: profile }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("status, current_period_end, grace_until")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("access_grants")
        .select("expires_at")
        .eq("user_id", userId)
        .is("revoked_at", null),
      supabase.from("profiles").select("role").eq("id", userId).single(),
    ]);

  // Admins keep access regardless of subscription state.
  if (profile?.role === "admin") return;

  const candidates: number[] = [];

  if (subscription) {
    if (subscription.status === "active" && subscription.current_period_end) {
      candidates.push(
        new Date(subscription.current_period_end).getTime() +
          RENEWAL_SLACK_HOURS * 3600 * 1000
      );
    } else if (subscription.status === "past_due" && subscription.grace_until) {
      candidates.push(new Date(subscription.grace_until).getTime());
    } else if (
      subscription.status === "canceled" &&
      subscription.current_period_end
    ) {
      candidates.push(new Date(subscription.current_period_end).getTime());
    }
  }

  const FAR_FUTURE = Date.parse("2200-01-01T00:00:00Z");
  for (const grant of grants ?? []) {
    candidates.push(grant.expires_at ? Date.parse(grant.expires_at) : FAR_FUTURE);
  }

  const max = candidates.length > 0 ? Math.max(...candidates) : null;
  await supabase
    .from("profiles")
    .update({
      access_valid_until: max ? new Date(max).toISOString() : null,
    })
    .eq("id", userId);
}
