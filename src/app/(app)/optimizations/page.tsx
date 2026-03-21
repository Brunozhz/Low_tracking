import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { RecommendationItem } from "@/components/dashboard/recommendation-item";
import { Card } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function OptimizationsPage() {
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
          O login de desenvolvimento está ativo, mas o PostgreSQL não está acessível em
          <code className="font-mono"> localhost:5432</code>.
        </p>
      </Card>
    );
  }

  if (!membership?.workspace.projects[0]) {
    return (
      <Card>
        <h2 className="text-xl font-semibold">Sem projeto ativo</h2>
      </Card>
    );
  }

  const project = membership.workspace.projects[0];

  const recommendations = await db.recommendation.findMany({
    where: {
      projectId: project.id,
    },
    orderBy: [{ priority: "desc" }, { priorityScore: "desc" }, { createdAt: "desc" }],
    take: 25,
  });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Central de otimizações</p>
        <h1 className="text-3xl font-bold text-zinc-100">O que fazer agora</h1>
        <p className="text-sm text-zinc-400">Priorização automática por impacto e confiança.</p>
      </section>

      {recommendations.length === 0 ? (
        <Card>
          <p className="text-zinc-300">Nenhuma recomendação ainda. Rode ingestão de eventos e geração de insights.</p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {recommendations.map((item) => (
            <RecommendationItem
              key={item.id}
              title={item.title}
              reason={item.reason}
              impact={item.impactSummary}
              priority={item.priority}
              confidence={item.confidenceScore}
            />
          ))}
        </div>
      )}
    </div>
  );
}
