import { WorkspaceRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/access";
import { db } from "@/lib/db";

const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(80),
  billingEmail: z.string().email().optional(),
});

function slugify(input: string) {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "workspace";
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "N?o autenticado" }, { status: 401 });
  }

  const workspaces = await db.workspace.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        {
          members: {
            some: {
              userId: user.id,
              status: "ACTIVE",
            },
          },
        },
      ],
    },
    include: {
      _count: {
        select: {
          projects: {
            where: {
              archivedAt: null,
            },
          },
        },
      },
      members: {
        where: {
          userId: user.id,
          status: "ACTIVE",
        },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      plan: workspace.plan,
      timezone: workspace.timezone,
      role: workspace.ownerId === user.id ? WorkspaceRole.ADMIN : workspace.members[0]?.role ?? WorkspaceRole.ANALYST,
      projectCount: workspace._count.projects,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "N?o autenticado" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = createWorkspaceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inv?lido", details: parsed.error.flatten() }, { status: 400 });
  }

  const slug = `${slugify(parsed.data.name)}-${randomSuffix()}`;

  const workspace = await db.$transaction(async (tx) => {
    const created = await tx.workspace.create({
      data: {
        ownerId: user.id,
        name: parsed.data.name,
        slug,
        billingEmail: parsed.data.billingEmail,
        plan: "PRO",
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: created.id,
        userId: user.id,
        role: WorkspaceRole.ADMIN,
        status: "ACTIVE",
      },
    });

    return created;
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
