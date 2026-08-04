import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Modelos" };

export default async function AdminTemplatesPage() {
  const supabase = await createClient();
  const { data: postTypes } = await supabase
    .from("post_types")
    .select("id, key, name, emoji, description")
    .is("archived_at", null)
    .order("position");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Modelos de post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada modelo define a estrutura que o editor já traz pronta ao criar um
          post. Edite a estrutura aqui — sem depender de programador.
        </p>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {(postTypes ?? []).map((type) => (
          <li key={type.id}>
            <Link
              href={`/admin/modelos/${type.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
            >
              <span className="text-lg">{type.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{type.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {type.description}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
