import "dotenv/config";

import bcrypt from "bcryptjs";
import { WorkspaceRole } from "@prisma/client";

import { createApiKey } from "../src/lib/api-key";
import { db } from "../src/lib/db";

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@lowtracking.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123456";
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrador";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const user = await db.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const workspace = await db.workspace.upsert({
    where: { slug: "workspace-main" },
    update: {
      ownerId: user.id,
    },
    create: {
      name: "Workspace Principal",
      slug: "workspace-main",
      ownerId: user.id,
      plan: "PRO",
    },
  });

  await db.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {
      role: WorkspaceRole.ADMIN,
      status: "ACTIVE",
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.ADMIN,
      status: "ACTIVE",
    },
  });

  const project = await db.project.upsert({
    where: {
      workspaceId_slug: {
        workspaceId: workspace.id,
        slug: "projeto-main",
      },
    },
    update: {
      name: "Projeto Principal",
      attributionModel: "LAST_TOUCH",
    },
    create: {
      workspaceId: workspace.id,
      name: "Projeto Principal",
      slug: "projeto-main",
      attributionModel: "LAST_TOUCH",
      allowedDomains: ["localhost", "127.0.0.1"],
    },
  });

  const apiKey = createApiKey();

  await db.apiKey.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      createdById: user.id,
      name: "Tracking API Key",
      prefix: apiKey.prefix,
      secretHash: apiKey.secretHash,
      scopes: ["events:write", "links:read"],
    },
  });

  console.log("\nSeed executado com sucesso:\n");
  console.log(`Admin: ${adminEmail}`);
  console.log(`Senha: ${adminPassword}`);
  console.log(`Workspace ID: ${workspace.id}`);
  console.log(`Project ID: ${project.id}`);
  console.log(`Tracking API Key (copie agora): ${apiKey.raw}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

