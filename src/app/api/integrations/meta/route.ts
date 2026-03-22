import { IntegrationStatus, IntegrationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureProjectAccess, getSessionUser } from "@/lib/access";
import { db } from "@/lib/db";

const connectMetaSchema = z.object({
  projectId: z.string().min(1),
  accessToken: z.string().min(20),
  adAccountExternalId: z.string().min(3),
  adAccountName: z.string().min(2).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().min(3).optional(),
});

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId obrigatorio" }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, projectId);
  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const integration = await db.integration.findFirst({
    where: {
      projectId,
      type: IntegrationType.META_ADS,
    },
    include: {
      adAccounts: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const syncLogs = await db.syncLog.findMany({
    where: {
      projectId,
      entity: "INSIGHTS",
    },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    connected: Boolean(integration && integration.status === IntegrationStatus.CONNECTED),
    integration: integration
      ? {
          id: integration.id,
          name: integration.name,
          status: integration.status,
          updatedAt: integration.updatedAt,
          adAccounts: integration.adAccounts.map((account) => ({
            id: account.id,
            externalId: account.externalId,
            name: account.name,
            currency: account.currency,
            timezone: account.timezone,
            isActive: account.isActive,
          })),
        }
      : null,
    syncLogs,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = connectMetaSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido", details: parsed.error.flatten() }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, parsed.data.projectId);
  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const existingIntegration = await db.integration.findFirst({
    where: {
      workspaceId: project.workspaceId,
      projectId: project.id,
      type: IntegrationType.META_ADS,
    },
  });

  const integration = existingIntegration
    ? await db.integration.update({
        where: { id: existingIntegration.id },
        data: {
          status: IntegrationStatus.CONNECTED,
          accessTokenEncrypted: parsed.data.accessToken,
          name: "Meta Ads",
          lastError: null,
          updatedAt: new Date(),
          createdById: user.id,
        },
      })
    : await db.integration.create({
        data: {
          workspaceId: project.workspaceId,
          projectId: project.id,
          createdById: user.id,
          type: IntegrationType.META_ADS,
          status: IntegrationStatus.CONNECTED,
          name: "Meta Ads",
          accessTokenEncrypted: parsed.data.accessToken,
        },
      });

  const adAccount = await db.adAccount.upsert({
    where: {
      workspaceId_externalId: {
        workspaceId: project.workspaceId,
        externalId: parsed.data.adAccountExternalId,
      },
    },
    update: {
      integrationId: integration.id,
      projectId: project.id,
      isActive: true,
      name: parsed.data.adAccountName ?? `Conta ${parsed.data.adAccountExternalId}`,
      currency: (parsed.data.currency ?? "BRL").toUpperCase(),
      timezone: parsed.data.timezone ?? "America/Sao_Paulo",
    },
    create: {
      workspaceId: project.workspaceId,
      projectId: project.id,
      integrationId: integration.id,
      externalId: parsed.data.adAccountExternalId,
      name: parsed.data.adAccountName ?? `Conta ${parsed.data.adAccountExternalId}`,
      currency: (parsed.data.currency ?? "BRL").toUpperCase(),
      timezone: parsed.data.timezone ?? "America/Sao_Paulo",
    },
  });

  return NextResponse.json({
    connected: true,
    integrationId: integration.id,
    adAccount,
  });
}
