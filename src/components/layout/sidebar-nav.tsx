"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { BarChart3, ChevronRight, Link2, Megaphone, Radar, Settings2, Sparkles } from "lucide-react";

import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tag?: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    title: "Operacao",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
      { href: "/links", label: "Links", icon: Link2 },
      { href: "/campaigns", label: "Campanhas", icon: Sparkles, tag: "AUTO" },
    ],
  },
  {
    title: "Tracking",
    items: [
      { href: "/events", label: "Eventos", icon: Radar },
      { href: "/integrations", label: "Integracoes", icon: Megaphone, tag: "Meta" },
      { href: "/settings", label: "Configuracoes", icon: Settings2 },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-72 shrink-0 border-r border-zinc-800/80 bg-zinc-950/85 p-5 lg:flex lg:flex-col">
        <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/60 via-zinc-900 to-zinc-950 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Low Tracking</p>
          <p className="mt-2 text-sm font-semibold text-zinc-100">Performance Control</p>
          <p className="mt-1 text-xs text-zinc-400">Tracking, atribuicao e decisao com IA</p>
        </div>

        <nav className="mt-6 space-y-5">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">{section.title}</p>
              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition",
                        active
                          ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                          : "border-transparent text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900/80 hover:text-zinc-100",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", active ? "text-cyan-300" : "text-zinc-500 group-hover:text-zinc-300")} />
                        {item.label}
                        {item.tag ? <Badge className="ml-1" variant="neutral">{item.tag}</Badge> : null}
                      </span>
                      <ChevronRight className={cn("h-4 w-4", active ? "text-cyan-300" : "text-zinc-600")} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-6">
          <UserMenu compact />
        </div>
      </aside>

      <div className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Low Tracking</p>
            <p className="text-sm text-zinc-300">Control Center</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-700 px-3 text-xs text-zinc-200"
          >
            Menu
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link href="/dashboard" className={cn("rounded-lg border px-2 py-2 text-center text-xs", isActivePath(pathname, "/dashboard") ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-zinc-800 bg-zinc-900 text-zinc-300")}>Dashboard</Link>
          <Link href="/links" className={cn("rounded-lg border px-2 py-2 text-center text-xs", isActivePath(pathname, "/links") ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-zinc-800 bg-zinc-900 text-zinc-300")}>Links</Link>
          <Link href="/campaigns" className={cn("rounded-lg border px-2 py-2 text-center text-xs", isActivePath(pathname, "/campaigns") ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-zinc-800 bg-zinc-900 text-zinc-300")}>Campanhas</Link>
        </div>
      </div>
    </>
  );
}



