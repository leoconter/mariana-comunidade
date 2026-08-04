"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/lib/database.types";
import { createAnnouncement, saveEmailTemplate } from "./actions";

export function AnnouncementForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bannerDays, setBannerDays] = useState("7");
  const [sendEmail, setSendEmail] = useState(true);

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-lg">
        <Megaphone className="size-5 text-primary" /> Novo comunicado
      </h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ann-title">Título</Label>
        <Input
          id="ann-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Round Clínico extra nesta quinta!"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ann-body">Mensagem</Label>
        <Textarea
          id="ann-body"
          rows={4}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Label htmlFor="ann-days" className="whitespace-nowrap">
            Banner por
          </Label>
          <Input
            id="ann-days"
            type="number"
            min={0}
            max={30}
            value={bannerDays}
            onChange={(e) => setBannerDays(e.target.value)}
            className="w-16"
          />
          dias
        </div>
        <label className="flex items-center gap-2 text-sm">
          Enviar por e-mail
          <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
        </label>
      </div>
      <Button
        className="self-start"
        disabled={pending || !title.trim()}
        onClick={() =>
          startTransition(async () => {
            const result = await createAnnouncement({
              title,
              bodyText,
              bannerDays: Number(bannerDays) || 0,
              sendEmail,
            });
            if (result.ok) {
              toast.success(result.message);
              setTitle("");
              setBodyText("");
              router.refresh();
            } else {
              toast.error(result.message);
            }
          })
        }
      >
        {pending ? "Publicando..." : "Publicar comunicado"}
      </Button>
    </section>
  );
}

const TEMPLATE_LABELS: Record<string, string> = {
  welcome: "Boas-vindas (assinatura ativada)",
  payment_failed: "Problema no pagamento",
  access_expired: "Acesso encerrado",
  new_post: "Novo conteúdo publicado",
  event_reminder: "Lembrete de evento",
  weekly_digest: "Resumo semanal",
};

export function EmailTemplatesEditor({
  templates,
}: {
  templates: Tables<"email_templates">[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Tables<"email_templates"> | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg">Modelos de e-mail</h2>
      <p className="text-sm text-muted-foreground">
        Textos dos e-mails automáticos. Variáveis como{" "}
        <code className="rounded bg-muted px-1 text-xs">{"{{nome}}"}</code> são
        substituídas na hora do envio.
      </p>
      <ul className="divide-y rounded-xl border bg-card">
        {templates.map((template) => (
          <li
            key={template.key}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {TEMPLATE_LABELS[template.key] ?? template.key}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Assunto: {template.subject}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setEditing(template);
                setSubject(template.subject);
                setBodyHtml(template.body_html);
              }}
            >
              <Pencil className="size-4" />
              <span className="sr-only">Editar modelo</span>
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? TEMPLATE_LABELS[editing.key] ?? editing.key : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Assunto</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Corpo (HTML)</Label>
              <Textarea
                rows={10}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    if (!editing) return;
                    const result = await saveEmailTemplate({
                      key: editing.key,
                      subject,
                      bodyHtml,
                    });
                    if (result.ok) {
                      toast.success("Modelo salvo.");
                      setEditing(null);
                      router.refresh();
                    } else {
                      toast.error(result.message);
                    }
                  })
                }
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
