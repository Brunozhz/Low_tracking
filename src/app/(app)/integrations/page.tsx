import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { MetaIntegrationPanel } from "@/components/dashboard/meta-integration-panel";
import { Card } from "@/components/ui/card";
import { getPrimaryProjectForUser } from "@/lib/access";
import { authOptions } from "@/lib/auth";

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const project = await getPrimaryProjectForUser(session.user.id);

  if (!project) {
    return (
      <Card>
        <h2 className="text-xl font-semibold">Sem projeto ativo</h2>
        <p className="mt-2 text-sm text-zinc-400">Crie um projeto na tela de Links antes de conectar a Meta.</p>
      </Card>
    );
  }

  return <MetaIntegrationPanel projectId={project.id} projectName={project.name} />;
}
