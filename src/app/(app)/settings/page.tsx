import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await db.workspaceMember.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
    },
    include: {
      workspace: {
        include: {
          projects: {
            where: { archivedAt: null },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      },
    },
  });

  const workspace = membership?.workspace;
  const project = workspace?.projects[0];

  if (!workspace || !project) {
    return (
      <Card>
        <h2 className="text-xl font-semibold">Sem configuracao inicial</h2>
        <p className="mt-2 text-sm text-zinc-400">Crie workspace e projeto para configurar regras de tracking.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Administracao</p>
        <h1 className="text-3xl font-bold text-zinc-100">Configuracoes</h1>
      </section>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Workspace atual</h2>
        <div className="mt-4 space-y-2 text-sm text-zinc-300">
          <p>Nome: <span className="font-semibold text-zinc-100">{workspace.name}</span></p>
          <p>Plano: <Badge variant="neutral">{workspace.plan}</Badge></p>
          <p>Timezone: {workspace.timezone}</p>
          <p>Moeda padrao: {workspace.defaultCurrency}</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Projeto ativo</h2>
        <div className="mt-4 space-y-2 text-sm text-zinc-300">
          <p>Nome: <span className="font-semibold text-zinc-100">{project.name}</span></p>
          <p>Modelo de atribuicao: <Badge variant="good">{project.attributionModel}</Badge></p>
          <p>Tracking habilitado: {project.isTrackingEnabled ? "Sim" : "Nao"}</p>
          <p>Dominios permitidos: {project.allowedDomains.length > 0 ? project.allowedDomains.join(", ") : "Nao definido"}</p>
        </div>
      </Card>
    </div>
  );
}
