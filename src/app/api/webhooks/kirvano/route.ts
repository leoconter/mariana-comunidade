import { NextResponse, type NextRequest } from "next/server";
import {
  isMappedEvent,
  normalizeKirvanoEvent,
  processKirvanoEvent,
} from "@/lib/kirvano";
import { createAdminClient } from "@/lib/supabase/admin";

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
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
