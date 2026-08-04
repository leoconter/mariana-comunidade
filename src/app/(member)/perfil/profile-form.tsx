"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteOwnAccount, updateOwnProfile } from "@/app/(member)/actions";
import type { Profile } from "@/lib/auth";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const prefs = (profile.email_prefs ?? {}) as {
    digest?: boolean;
    announcements?: boolean;
  };

  const [fullName, setFullName] = useState(profile.full_name);
  const [city, setCity] = useState(profile.city ?? "");
  const [state, setState] = useState(profile.state ?? "");
  const [crefito, setCrefito] = useState(profile.crefito ?? "");
  const [years, setYears] = useState(
    profile.years_experience?.toString() ?? ""
  );
  const [bio, setBio] = useState(profile.bio ?? "");
  const [directoryVisible, setDirectoryVisible] = useState(
    profile.directory_visible
  );
  const [emailDigest, setEmailDigest] = useState(prefs.digest ?? true);
  const [emailAnnouncements, setEmailAnnouncements] = useState(
    prefs.announcements ?? true
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-name">Nome completo</Label>
          <Input
            id="profile-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-city">Cidade</Label>
            <Input
              id="profile-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-state">UF</Label>
            <Input
              id="profile-state"
              value={state}
              maxLength={2}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-crefito">CREFITO</Label>
            <Input
              id="profile-crefito"
              value={crefito}
              onChange={(e) => setCrefito(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-years">Anos de atuação</Label>
            <Input
              id="profile-years"
              type="number"
              min={0}
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-bio">Bio curta</Label>
          <Textarea
            id="profile-bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Conte em poucas linhas sobre sua atuação..."
          />
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          Aparecer no diretório de membras
          <Switch
            checked={directoryVisible}
            onCheckedChange={setDirectoryVisible}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">E-mails</p>
        <label className="flex items-center justify-between gap-3 text-sm">
          Resumo semanal dos conteúdos
          <Switch checked={emailDigest} onCheckedChange={setEmailDigest} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          Comunicados importantes
          <Switch
            checked={emailAnnouncements}
            onCheckedChange={setEmailAnnouncements}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Para deixar de ser avisada sobre um espaço específico, use o botão
          “Seguindo” dentro do próprio espaço.
        </p>
      </div>

      <Button
        className="self-start"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await updateOwnProfile({
              fullName,
              city,
              state,
              crefito,
              yearsExperience: years ? Number(years) : null,
              bio,
              directoryVisible,
              emailDigest,
              emailAnnouncements,
            });
            if (result.ok) toast.success("Perfil salvo.");
            else toast.error(result.message);
          })
        }
      >
        {pending ? "Salvando..." : "Salvar perfil"}
      </Button>

      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <p className="text-sm font-medium">Seus dados (LGPD)</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export/me">Baixar meus dados</a>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                Excluir minha conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é irreversível: seu perfil, comentários, casos
                  enviados e histórico serão apagados. A assinatura na Kirvano
                  deve ser cancelada por lá separadamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await deleteOwnAccount();
                      } catch {
                        toast.error("Não foi possível excluir a conta.");
                      }
                    })
                  }
                >
                  Excluir definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <p className="text-xs text-muted-foreground">
          Dúvidas sobre privacidade? Leia a{" "}
          <a href="/privacidade" className="underline underline-offset-2">
            Política de Privacidade
          </a>
          .
        </p>
      </div>
    </div>
  );
}
