import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar");
  if (profile.role !== "admin") redirect("/");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="size-4" />
                <span className="sr-only sm:not-sr-only">Comunidade</span>
              </Link>
            </Button>
            <span className="font-heading text-lg text-primary">Painel</span>
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 px-3 py-4 sm:px-4 md:flex-row md:gap-8">
        <aside className="md:w-48 md:shrink-0">
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
