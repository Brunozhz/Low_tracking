"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setIsLoading(false);
    toast.success("Se o email existir, um token de recuperação foi gerado no log do servidor.");
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Recuperação</p>
        <h1 className="mt-2 text-2xl font-bold">Esqueci minha senha</h1>
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

        <Button className="w-full" disabled={isLoading} type="submit">
          {isLoading ? "Processando..." : "Gerar token de recuperação"}
        </Button>
      </form>
    </div>
  );
}

