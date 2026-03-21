import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { UserMenu } from "@/components/layout/user-menu";
import { authOptions } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/links", label: "Links" },
  { href: "/optimizations", label: "Otimizacoes" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-950/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Low Tracking</p>
            <p className="text-sm text-zinc-300">Operation Control Center</p>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-zinc-300 transition hover:text-cyan-300">
                {item.label}
              </Link>
            ))}
          </nav>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

