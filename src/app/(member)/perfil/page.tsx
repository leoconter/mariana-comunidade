import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar");

  return (
    <div className="flex max-w-lg flex-col gap-5">
      <div>
        <h1 className="text-2xl">Meu perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Como você aparece para as outras membras — e o que chega no seu
          e-mail.
        </p>
      </div>
      <ProfileForm profile={profile} />
    </div>
  );
}
