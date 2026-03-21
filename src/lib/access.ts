import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function ensureWorkspaceAccess(userId: string, workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        where: {
          userId,
          status: "ACTIVE",
        },
        take: 1,
      },
    },
  });

  if (!workspace) {
    return null;
  }

  if (workspace.ownerId === userId || workspace.members.length > 0) {
    return workspace;
  }

  return null;
}

export async function ensureProjectAccess(userId: string, projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: {
        include: {
          members: {
            where: {
              userId,
              status: "ACTIVE",
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  if (project.workspace.ownerId === userId || project.workspace.members.length > 0) {
    return project;
  }

  return null;
}

export async function getPrimaryProjectForUser(userId: string) {
  const membership = await db.workspaceMember.findFirst({
    where: {
      userId,
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
    orderBy: { createdAt: "asc" },
  });

  return membership?.workspace.projects[0] ?? null;
}
