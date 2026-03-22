"use client";

import { signOut, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { data } = useSession();

  if (compact) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
        <p className="truncate text-sm font-medium text-zinc-100">{data?.user?.name ?? "Usuario"}</p>
        <p className="truncate text-xs text-zinc-400">{data?.user?.email}</p>
        <Button className="mt-3 w-full" variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sair
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-medium text-zinc-100">{data?.user?.name ?? "Usuario"}</p>
        <p className="text-xs text-zinc-400">{data?.user?.email}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
        Sair
      </Button>
    </div>
  );
}
