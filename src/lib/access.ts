import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
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
