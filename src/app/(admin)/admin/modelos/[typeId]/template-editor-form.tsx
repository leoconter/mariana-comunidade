"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { JSONContent } from "@tiptap/react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import type { Json, Tables } from "@/lib/database.types";
import { EMPTY_DOC } from "@/lib/tiptap";
import { saveTemplate } from "../actions";

export function TemplateEditorForm({
  postType,
}: {
  postType: Tables<"post_types">;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(postType.name);
  const [emoji, setEmoji] = useState(postType.emoji ?? "");
  const [description, setDescription] = useState(postType.description ?? "");
  const [bodyTemplate, setBodyTemplate] = useState<JSONContent>(
    (postType.body_template as JSONContent) ?? EMPTY_DOC
  );
  const [fieldSchemaJson, setFieldSchemaJson] = useState(
    JSON.stringify(postType.field_schema ?? [], null, 2)
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/admin/modelos">
            <ArrowLeft className="size-4" /> Modelos
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl">Editar modelo</h1>
      </div>

      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="template-emoji">Emoji</Label>
          <Input
            id="template-emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="template-name">Nome</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="template-description">Descrição</Label>
        <Textarea
          id="template-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Estrutura do post</Label>
        <p className="text-xs text-muted-foreground">
          O que você escrever aqui aparece pré-preenchido no editor sempre que
          um post deste tipo for criado.
        </p>
        <RichTextEditor
          content={bodyTemplate}
          onChange={setBodyTemplate}
          placeholder="Estrutura pré-preenchida do post..."
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="template-fields">Campos extras (avançado, JSON)</Label>
        <p className="text-xs text-muted-foreground">
          Define campos como o seletor de impacto clínico. Só edite se souber o
          que está fazendo.
        </p>
        <Textarea
          id="template-fields"
          rows={8}
          value={fieldSchemaJson}
          onChange={(e) => setFieldSchemaJson(e.target.value)}
          className="font-mono text-xs"
        />
      </div>

      <Button
        className="self-start"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await saveTemplate({
              id: postType.id,
              name,
              emoji,
              description,
              bodyTemplate: bodyTemplate as Json,
              fieldSchemaJson,
            });
            if (result.ok) toast.success("Modelo salvo.");
            else toast.error(result.message);
          })
        }
      >
        {pending ? "Salvando..." : "Salvar modelo"}
      </Button>
    </div>
  );
}
