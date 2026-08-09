import { NextResponse, type NextRequest } from "next/server";
import {
  isIgnoredEvent,
  isMappedEvent,
  normalizeKirvanoEvent,
  processKirvanoEvent,
} from "@/lib/kirvano";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Health check for the integration. Reports only whether each piece of
 * configuration exists — never a value — so the setup can be verified from
 * outside without database access.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "kirvano",
    token_configurado: Boolean(process.env.KIRVANO_WEBHOOK_TOKEN),
    service_role_configurada: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    email_configurado: Boolean(
      process.env.RESEND_API_KEY && process.env.EMAIL_FROM
    ),
    site_url: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  });
}

/**
 * Kirvano webhook. Kirvano sends the configured security token in the
 * `security-token` header — set the same value in KIRVANO_WEBHOOK_TOKEN.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.KIRVANO_WEBHOOK_TOKEN;
  const received =
    request.headers.get("security-token") ??
    request.headers.get("x-security-token") ??
    request.nextUrl.searchParams.get("token");

  if (!expected || received !== expected) {
    // Record the rejection (never the payload or the token itself) so that
    // "Kirvano is calling but the token is wrong" is distinguishable from
    // "Kirvano never called". Failures here must not change the response.
    try {
      await createAdminClient()
        .from("kirvano_webhook_events")
        .insert({
          external_event_id: `rejeitado:${Date.now()}`,
          event_type: "NAO_AUTORIZADO",
          payload: {} as never,
          error: !expected
            ? "A chamada chegou, mas KIRVANO_WEBHOOK_TOKEN não está configurado no servidor."
            : received
              ? "A chamada chegou com um token que não confere com KIRVANO_WEBHOOK_TOKEN."
              : "A chamada chegou sem nenhum token de segurança.",
        });
    } catch {
      // Service-role key missing — nothing to log with.
    }
    // The reason is echoed back (never the token) so the cause is visible in
    // Kirvano's own delivery log, without depending on the database.
    return NextResponse.json(
      {
        error: "unauthorized",
        reason: !expected
          ? "KIRVANO_WEBHOOK_TOKEN_NAO_CONFIGURADO"
          : received
            ? "TOKEN_DIVERGENTE"
            : "TOKEN_AUSENTE_NA_REQUISICAO",
      },
      { status: 401 }
    );
  }

  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const event = normalizeKirvanoEvent(payload);
  if (!event) {
    const rawEvent = String(
      payload.event ?? payload.event_type ?? payload.type ?? ""
    );
    // PIX generated, bank slip expired… nothing to decide, and no reason to
    // show them as failures in the panel.
    if (isIgnoredEvent(rawEvent)) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    // Unrecognised events are acknowledged (200) so Kirvano stops retrying,
    // but they are still recorded: the real event names have to be readable
    // in /admin/configuracoes, otherwise a mismatch between Kirvano's
    // vocabulary and EVENT_MAP would fail silently and no access would be
    // granted after a purchase.
    const rawType = String(
      payload.event ?? payload.event_type ?? payload.type ?? "DESCONHECIDO"
    ).toUpperCase();
    await createAdminClient()
      .from("kirvano_webhook_events")
      .insert({
        external_event_id: `unmapped:${rawType}:${Date.now()}`,
        event_type: rawType,
        payload: payload as never,
        error: isMappedEvent(rawType)
          ? "evento reconhecido, mas sem e-mail da compradora no payload"
          : "evento não reconhecido — falta mapear em EVENT_MAP",
      });
    return NextResponse.json({ ok: true, ignored: true, event: rawType });
  }

  const result = await processKirvanoEvent(event);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, skipped: result.skipped ?? false });
}
