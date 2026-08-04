import { NextResponse, type NextRequest } from "next/server";
import { normalizeKirvanoEvent, processKirvanoEvent } from "@/lib/kirvano";

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
    // Unknown event types are acknowledged (200) so Kirvano does not retry.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await processKirvanoEvent(event);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, skipped: result.skipped ?? false });
}
