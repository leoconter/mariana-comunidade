/**
 * Config guard for the Supabase client credentials.
 *
 * NEXT_PUBLIC_* values are inlined by Next at BUILD time, so they must exist
 * in the build environment (on Vercel: set them, then redeploy — adding a
 * variable alone does not fix an already-built deployment).
 *
 * Referenced as full literal expressions so the bundler can inline them.
 */
export function missingSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return missing;
}

export function isSupabaseConfigured(): boolean {
  return missingSupabaseEnv().length === 0;
}
