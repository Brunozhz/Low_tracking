import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { MetricCard } from "@/components/dashboard/metric-card";
import { Card } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  let membership;
  try {
    membership = await db.workspaceMember.findFirst({
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
  } catch {
    return (
      <Card>
        <h2 className="text-xl font-semibold">Banco de dados indisponível</h2>
        <p className="mt-2 text-sm text-zinc-300">
          O login de desenvolvimento funcionou, mas o PostgreSQL não está acessível em
          <code className="font-mono"> localhost:5432</code>.
        </p>
      </Card>
    );
  }

  if (!membership?.workspace.projects[0]) {
    return (
      <Card>
        <h2 className="text-xl font-semibold">Nenhum projeto encontrado</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Execute o script de seed para criar workspace e projeto inicial: <code className="font-mono">npm run seed</code>.
        </p>
      </Card>
    );
  }

  const project = membership.workspace.projects[0];

  const [eventsCount, conversionCount, spendAgg, revenueAgg, alertsCount] = await Promise.all([
    db.event.count({ where: { projectId: project.id } }),
    db.conversion.count({ where: { projectId: project.id } }),
    db.metaMetricDaily.aggregate({
      _sum: { spend: true },
      where: { projectId: project.id },
    }),
    db.conversion.aggregate({
      _sum: { revenue: true },
      where: {
        projectId: project.id,
        status: "APPROVED",
      },
    }),
    db.alert.count({
      where: {
        projectId: project.id,
        status: "OPEN",
      },
    }),
  ]);

  const spend = Number(spendAgg._sum.spend ?? 0);
  const revenue = Number(revenueAgg._sum.revenue ?? 0);
  const roas = spend > 0 ? (revenue / spend).toFixed(2) : "0.00";

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Visão geral</p>
        <h1 className="text-3xl font-bold text-zinc-100">{project.name}</h1>
        <p className="text-sm text-zinc-400">Tracking em tempo real, atribuição e performance consolidada.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Eventos" value={eventsCount.toLocaleString("pt-BR")} />
        <MetricCard title="Conversões" value={conversionCount.toLocaleString("pt-BR")} />
        <MetricCard title="Investimento" value={`R$ ${spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        <MetricCard title="Receita" value={`R$ ${revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        <MetricCard title="ROAS" value={roas} delta={alertsCount > 0 ? `${alertsCount} alertas abertos` : "Operação estável"} />
      </section>
    </div>
  );
}
