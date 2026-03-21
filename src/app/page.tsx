import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const highlights = [
  "Tracking first-touch e last-touch por projeto",
  "Conciliação Meta Ads x conversão real",
  "Motor de recomendações com score de prioridade",
  "Alertas automáticos de queda, desperdício e inconsistência",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-16 pt-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Low Tracking</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-100">SaaS de Performance para Meta Ads</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Criar conta</Link>
          </Button>
        </div>
      </header>

      <section className="mt-14 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">MVP pronto para evoluir</p>
          <h2 className="text-4xl font-bold leading-tight text-zinc-50">
            Tracking + IA + decisões de mídia em um só lugar
          </h2>
          <p className="text-zinc-300">
            Arquitetura multi-workspace, eventos server-side, integração Meta Ads e camada de otimização orientada a ROAS.
          </p>
        </Card>

        <Card className="space-y-4">
          <h3 className="text-sm uppercase tracking-[0.2em] text-zinc-400">Capacidades-chave</h3>
          <ul className="space-y-3 text-sm text-zinc-200">
            {highlights.map((item) => (
              <li key={item} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </main>
  );
}

