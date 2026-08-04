import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles both Supabase auth link formats:
 * - token_hash + type (recommended email template, works across browsers)
 * - code (PKCE flow, default ConfirmationURL redirect)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("proximo") ?? "/";

  const redirectTo = new URL(
    next.startsWith("/") ? next : "/",
    request.nextUrl.origin
  );

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(redirectTo);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(redirectTo);
  }

  const errorUrl = new URL("/entrar", request.nextUrl.origin);
  errorUrl.searchParams.set("erro", "link-invalido");
  return NextResponse.redirect(errorUrl);
}
