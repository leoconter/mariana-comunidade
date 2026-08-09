import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Builds a "define your password" link that points straight at our own
 * /auth/confirm route using the token hash.
 *
 * Deliberately avoids Supabase's own redirect: no dependency on the project's
 * Site URL or redirect allow list, and it works when opened on a different
 * device than the one that requested it (unlike the PKCE `code` flow).
 */
export async function createPasswordSetupLink(
  email: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return null;

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const next = encodeURIComponent("/nova-senha");
  return `${site}/auth/confirm?token_hash=${tokenHash}&type=recovery&proximo=${next}`;
}
