"use client";

import { signOut, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { data } = useSession();

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-medium text-zinc-100">{data?.user?.name ?? "Usuário"}</p>
        <p className="text-xs text-zinc-400">{data?.user?.email}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
        Sair
      </Button>
    </div>
  );
}

