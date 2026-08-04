import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

const PUBLIC_PATHS = [
  "/entrar",
  "/auth",
  "/termos",
  "/privacidade",
  "/api/webhooks",
  "/manifest.webmanifest",
];

export async function updateSession(request: NextRequest) {
  // Without credentials the Supabase client throws, which would turn every
  // route — even static ones — into an opaque 500. Show what is missing.
  if (!isSupabaseConfigured()) {
    if (request.nextUrl.pathname === "/configuracao") {
      return NextResponse.next({ request });
    }
    return NextResponse.rewrite(new URL("/configuracao", request.url));
  }

  // Supabase falls back to the project's Site URL (usually "/") when the
  // magic link's redirect_to is not in the allow list. Catch the auth code
  // wherever it lands so the sign-in still completes instead of being
  // dropped by the redirect to /entrar below.
  const { pathname, searchParams } = request.nextUrl;
  if (
    pathname !== "/auth/confirm" &&
    (searchParams.has("code") || searchParams.has("token_hash"))
  ) {
    const confirmUrl = request.nextUrl.clone();
    confirmUrl.pathname = "/auth/confirm";
    if (pathname !== "/" && !searchParams.has("proximo")) {
      confirmUrl.searchParams.set("proximo", pathname);
    }
    return NextResponse.redirect(confirmUrl);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getClaims —
  // the session refresh depends on this call.
  const { data } = await supabase.auth.getClaims();

  const isPublic = PUBLIC_PATHS.some(
    (p) =>
      request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`)
  );

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("proximo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
