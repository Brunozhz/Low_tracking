import { EventType } from "@prisma/client";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Card } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const eventLabels: Record<EventType, string> = {
  CLICK: "Click",
  PAGEVIEW: "Pageview",
  LEAD: "Lead",
  CHECKOUT_INITIATED: "Checkout iniciado",
  PURCHASE_APPROVED: "Compra aprovada",
  PURCHASE_DECLINED: "Compra recusada",
  UPSELL: "Upsell",
  SUBSCRIPTION: "Assinatura",
  REFUND: "Reembolso",
  CUSTOM: "Custom",
};

export default async function EventsPage() {
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

  const project = membership?.workspace.projects[0];

  if (!project) {
    return (
      <Card>
        <h2 className="text-xl font-semibold">Sem projeto ativo</h2>
        <p className="mt-2 text-sm text-zinc-400">Crie um projeto na tela de Links para comecar o tracking.</p>
      </Card>
    );
  }

  const [groupedEvents, recentEvents] = await Promise.all([
    db.event.groupBy({
      by: ["type"],
      where: { projectId: project.id },
      _count: true,
    }),
    db.event.findMany({
      where: { projectId: project.id },
      orderBy: { occurredAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        name: true,
        source: true,
        occurredAt: true,
        value: true,
        orderId: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Tracking</p>
        <h1 className="text-3xl font-bold text-zinc-100">Eventos</h1>
        <p className="text-sm text-zinc-400">Visao rapida dos eventos recebidos pela plataforma.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {groupedEvents.map((group) => (
          <Card key={group.type}>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{eventLabels[group.type]}</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-100">{group._count.toLocaleString("pt-BR")}</p>
          </Card>
        ))}
      </section>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300">Eventos recentes</h2>
        {recentEvents.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">Nenhum evento recebido ainda.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-400">
                  <th className="px-2 py-2">Data</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2">Nome</th>
                  <th className="px-2 py-2">Origem</th>
                  <th className="px-2 py-2">Order</th>
                  <th className="px-2 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => (
                  <tr key={event.id} className="border-b border-zinc-900 text-zinc-200">
                    <td className="px-2 py-2">{new Date(event.occurredAt).toLocaleString("pt-BR")}</td>
                    <td className="px-2 py-2">{eventLabels[event.type]}</td>
                    <td className="px-2 py-2">{event.name}</td>
                    <td className="px-2 py-2">{event.source}</td>
                    <td className="px-2 py-2">{event.orderId ?? "-"}</td>
                    <td className="px-2 py-2 text-right">{event.value ? `R$ ${Number(event.value).toLocaleString("pt-BR")}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
