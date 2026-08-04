"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Home, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavSpace = {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
};

export type NavSection = {
  id: string;
  name: string;
  spaces: NavSpace[];
};

const FIXED_LINKS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/salvos", label: "Salvos", icon: Bookmark },
  { href: "/membros", label: "Membras", icon: Users },
];

export function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
      active
        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent/60"
    );

  return (
    <nav className="flex flex-col gap-6 p-3">
      <div className="flex flex-col gap-0.5">
        {FIXED_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={linkClass(pathname === href)}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            {label}
          </Link>
        ))}
      </div>
      {sections.map(
        (section) =>
          section.spaces.length > 0 && (
            <div key={section.id} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.name}
              </p>
              {section.spaces.map((space) => {
                const href = `/e/${space.slug}`;
                return (
                  <Link
                    key={space.id}
                    href={href}
                    onClick={onNavigate}
                    className={linkClass(pathname.startsWith(href))}
                  >
                    <span className="w-5 shrink-0 text-center">
                      {space.emoji ?? "•"}
                    </span>
                    <span className="truncate">{space.name}</span>
                  </Link>
                );
              })}
            </div>
          )
      )}
    </nav>
  );
}
