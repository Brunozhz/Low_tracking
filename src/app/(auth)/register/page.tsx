"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      setIsLoading(false);
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Falha ao criar conta");
      return;
    }

    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/dashboard",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Cadastro</p>
        <h1 className="mt-2 text-2xl font-bold">Criar conta</h1>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Nome</span>
          <input
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none ring-cyan-400 focus:ring-2"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Email</span>
          <input
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none ring-cyan-400 focus:ring-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Senha</span>
          <input
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none ring-cyan-400 focus:ring-2"
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <Button className="w-full" disabled={isLoading} type="submit">
          {isLoading ? "Criando..." : "Criar conta"}
        </Button>
      </form>

      <p className="text-sm text-zinc-400">
        Já possui conta?{" "}
        <Link href="/login" className="text-cyan-300 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}

