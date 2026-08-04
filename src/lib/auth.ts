import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;

/** Current user's profile, cached per request. Null when signed out. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
});

/** Throws unless the current user is an admin. For use in server actions. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("Acesso restrito.");
  return profile;
}

/** Throws unless the current user is admin or moderator. */
export async function requireStaff(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin" && profile?.role !== "moderator")
    throw new Error("Acesso restrito.");
  return profile;
}

export function isStaff(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "moderator";
}

export function hasValidAccess(profile: Profile | null): boolean {
  if (!profile || profile.banned_at) return false;
  if (isStaff(profile)) return true;
  return (
    profile.access_valid_until !== null &&
    new Date(profile.access_valid_until) > new Date()
  );
}
