"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      toast.error("Credenciais inválidas");
      return;
    }

    window.location.href = "/dashboard";
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Acesso</p>
        <h1 className="mt-2 text-2xl font-bold">Entrar na plataforma</h1>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <Button className="w-full" disabled={isLoading} type="submit">
          {isLoading ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <p className="text-sm text-zinc-400">
        Esqueceu a senha?{" "}
        <Link href="/forgot-password" className="text-cyan-300 hover:underline">
          Recuperar
        </Link>
      </p>

      <p className="text-sm text-zinc-400">
        Ainda não tem conta?{" "}
        <Link href="/register" className="text-cyan-300 hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}

