import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CampaignsWorkbench } from "@/components/campaigns/campaigns-workbench";
import { Card } from "@/components/ui/card";
import { getPrimaryProjectForUser } from "@/lib/access";
import { authOptions } from "@/lib/auth";

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const project = await getPrimaryProjectForUser(session.user.id);

  if (!project) {
    return (
      <Card>
        <h2 className="text-xl font-semibold">Sem projeto ativo</h2>
        <p className="mt-2 text-sm text-zinc-400">Crie um projeto primeiro para visualizar campanhas e automacoes.</p>
      </Card>
    );
  }

  return <CampaignsWorkbench projectId={project.id} projectName={project.name} />;
}
