import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, LogOut, Megaphone, Settings, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConsentRecorder } from "@/components/member/consent-recorder";
import { MobileSidebar } from "@/components/member/mobile-sidebar";
import { SidebarNav, type NavSection } from "@/components/member/sidebar-nav";
import { getCurrentProfile, hasValidAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar");
  if (!hasValidAccess(profile)) redirect("/acesso-negado");

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [
    { data: sections },
    { data: spaces },
    { data: subscription },
    { count: unreadCount },
    { data: announcement },
  ] = await Promise.all([
    supabase.from("sections").select("id, name, position").order("position"),
    supabase
      .from("spaces")
      .select("id, name, slug, emoji, section_id, position")
      .is("archived_at", null)
      .order("position"),
    supabase
      .from("subscriptions")
      .select("status, grace_until, current_period_end")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .is("read_at", null),
    supabase
      .from("announcements")
      .select("id, title")
      .gt("show_banner_until", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const now = new Date();
  const graceBanner =
    subscription?.status === "past_due" &&
    subscription.grace_until &&
    new Date(subscription.grace_until) > now
      ? {
          tone: "warning" as const,
          text: `Detectamos um problema no pagamento da sua assinatura. Regularize até ${formatDate(subscription.grace_until)} para não perder o acesso.`,
        }
      : subscription?.status === "canceled" &&
          subscription.current_period_end &&
          new Date(subscription.current_period_end) > now
        ? {
            tone: "info" as const,
            text: `Sua assinatura foi cancelada. Você mantém o acesso até ${formatDate(subscription.current_period_end)}.`,
          }
        : null;

  const navSections: NavSection[] = (sections ?? []).map((section) => ({
    id: section.id,
    name: section.name,
    spaces: (spaces ?? []).filter((s) => s.section_id === section.id),
  }));
  const orphanSpaces = (spaces ?? []).filter((s) => !s.section_id);
  if (orphanSpaces.length > 0) {
    navSections.push({ id: "outros", name: "Espaços", spaces: orphanSpaces });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex items-center gap-1">
            <MobileSidebar sections={navSections} />
            <Link href="/" className="font-heading text-lg text-primary">
              Comunidade
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild className="relative">
              <Link href="/notificacoes">
                <Bell className="size-4" />
                {(unreadCount ?? 0) > 0 && (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {Math.min(unreadCount ?? 0, 9)}
                  </span>
                )}
                <span className="sr-only">Notificações</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/perfil">
                <UserRound className="size-4" />
                <span className="sr-only">Meu perfil</span>
              </Link>
            </Button>
            {profile.role === "admin" && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin">
                  <Settings className="size-4" />
                  <span className="sr-only sm:not-sr-only">Painel</span>
                </Link>
              </Button>
            )}
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="size-4" />
                <span className="sr-only sm:not-sr-only">Sair</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      {announcement && (
        <div className="flex items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-sm text-primary-foreground">
          <Megaphone className="size-4 shrink-0" />
          {announcement.title}
        </div>
      )}
      {graceBanner && (
        <div
          className={
            graceBanner.tone === "warning"
              ? "bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              : "bg-secondary px-4 py-2 text-center text-sm text-secondary-foreground"
          }
        >
          {graceBanner.text}{" "}
          <Link href="/assinatura" className="underline underline-offset-2">
            Ver assinatura
          </Link>
        </div>
      )}
      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r bg-sidebar md:block">
          <SidebarNav sections={navSections} />
        </aside>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {children}
          <footer className="mt-12 border-t pt-4 text-center text-xs text-muted-foreground">
            <Link href="/termos" className="underline underline-offset-2">
              Termos de Uso
            </Link>{" "}
            ·{" "}
            <Link href="/privacidade" className="underline underline-offset-2">
              Política de Privacidade
            </Link>
          </footer>
        </main>
      </div>
      <ConsentRecorder />
    </div>
  );
}
