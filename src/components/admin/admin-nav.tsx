"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/espacos", label: "Espaços" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/modelos", label: "Modelos" },
  { href: "/admin/midia", label: "Mídia" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/eventos", label: "Eventos" },
  { href: "/admin/membros", label: "Membros" },
  { href: "/admin/moderacao", label: "Moderação" },
  { href: "/admin/comunicados", label: "Comunicados" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="scrollbar-none -mx-3 flex gap-1 overflow-x-auto px-3 pb-2 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:pb-0">
      {LINKS.map(({ href, label }) => {
        const active =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
