import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { createPost } from "../actions";

export const metadata: Metadata = { title: "Novo post" };

export default async function NewPostPage() {
  const supabase = await createClient();
  const [{ data: spaces }, { data: postTypes }] = await Promise.all([
    supabase
      .from("spaces")
      .select("id, name, emoji")
      .is("archived_at", null)
      .order("position"),
    supabase
      .from("post_types")
      .select("id, key, name, emoji, description")
      .is("archived_at", null)
      .order("position"),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl">Novo post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o espaço e o modelo. O editor já vem estruturado para o tipo
          escolhido.
        </p>
      </div>

      <form action={createPost} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="space">Espaço</Label>
          <select
            id="space"
            name="space_id"
            required
            className="h-9 rounded-lg border bg-card px-3 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Escolha o espaço...
            </option>
            {(spaces ?? []).map((space) => (
              <option key={space.id} value={space.id}>
                {space.emoji} {space.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1 text-sm font-medium">Modelo</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-secondary/50">
              <input
                type="radio"
                name="post_type_id"
                value=""
                defaultChecked
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">✏️ Post livre</span>
                <span className="block text-xs text-muted-foreground">
                  Editor em branco, sem estrutura pré-definida.
                </span>
              </span>
            </label>
            {(postTypes ?? []).map((type) => (
              <label
                key={type.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-secondary/50"
              >
                <input
                  type="radio"
                  name="post_type_id"
                  value={type.id}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">
                    {type.emoji} {type.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {type.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" className="self-start">
          Continuar para o editor
        </Button>
      </form>
    </div>
  );
}
