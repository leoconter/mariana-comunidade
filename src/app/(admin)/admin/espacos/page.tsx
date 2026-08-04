import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SpacesManager } from "./spaces-manager";

export const metadata: Metadata = { title: "Espaços" };

export default async function AdminSpacesPage() {
  const supabase = await createClient();
  const [{ data: sections }, { data: spaces }] = await Promise.all([
    supabase.from("sections").select("*").order("position"),
    supabase.from("spaces").select("*").order("position"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Espaços</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize os espaços da comunidade em seções. Arraste para reordenar —
          a ordem aqui é a ordem da navegação das membras.
        </p>
      </div>
      <SpacesManager sections={sections ?? []} spaces={spaces ?? []} />
    </div>
  );
}
