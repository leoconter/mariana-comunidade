"use client";

import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { baseExtensions } from "@/lib/tiptap";

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Escreva aqui...",
  className,
}: {
  content: JSONContent;
  onChange: (doc: JSONContent) => void;
  placeholder?: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [...baseExtensions(), Placeholder.configure({ placeholder })],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral max-w-none min-h-[16rem] px-3 py-2 focus:outline-none prose-headings:font-heading",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  if (!editor) {
    return (
      <div className={cn("rounded-lg border", className)}>
        <div className="min-h-[16rem] animate-pulse rounded-lg bg-muted/40" />
      </div>
    );
  }

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Endereço do link:", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  const controls: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    action: () => void;
    active?: boolean;
  }[] = [
    {
      icon: Heading2,
      label: "Título",
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive("heading", { level: 2 }),
    },
    {
      icon: Heading3,
      label: "Subtítulo",
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive("heading", { level: 3 }),
    },
    {
      icon: Bold,
      label: "Negrito",
      action: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive("bold"),
    },
    {
      icon: Italic,
      label: "Itálico",
      action: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive("italic"),
    },
    {
      icon: List,
      label: "Lista",
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
    },
    {
      icon: ListOrdered,
      label: "Lista numerada",
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
    },
    {
      icon: Quote,
      label: "Citação",
      action: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive("blockquote"),
    },
    {
      icon: Code,
      label: "Código",
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      active: editor.isActive("codeBlock"),
    },
    { icon: Link2, label: "Link", action: setLink, active: editor.isActive("link") },
    {
      icon: Minus,
      label: "Divisor",
      action: () => editor.chain().focus().setHorizontalRule().run(),
    },
  ];

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b p-1">
        {controls.map(({ icon: Icon, label, action, active }, index) => (
          <span key={label} className="flex items-center">
            {(index === 2 || index === 4 || index === 8) && (
              <Separator orientation="vertical" className="mx-1 h-5" />
            )}
            <Button
              type="button"
              variant={active ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={action}
              title={label}
            >
              <Icon className="size-4" />
              <span className="sr-only">{label}</span>
            </Button>
          </span>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
