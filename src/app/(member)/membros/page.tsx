import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Membras" };

export default async function MembersDirectoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS already limits rows to directory_visible profiles (plus self/staff).
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, city, state, crefito, years_experience, bio, directory_visible, role")
    .eq("directory_visible", true)
    .neq("role", "admin")
    .order("full_name");

  const visible = (members ?? []).filter(
    (member) => member.id !== user!.id && member.full_name
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl">Membras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Colegas de comunidade — fisioterapeutas pélvicas do Brasil inteiro.
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <Users className="size-6 text-primary" />
          <p className="max-w-sm text-sm text-muted-foreground">
            O diretório vai se preencher conforme as membras completarem o
            perfil. Complete o seu em “Meu perfil”!
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((member) => {
            const initials = member.full_name
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <li
                key={member.id}
                className="flex gap-3 rounded-xl border bg-card p-4"
              >
                <Avatar className="size-10">
                  <AvatarFallback className="bg-secondary text-sm text-secondary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      member.city && member.state
                        ? `${member.city}/${member.state}`
                        : member.city || member.state,
                      member.years_experience
                        ? `${member.years_experience} anos de atuação`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {member.bio && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {member.bio}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
