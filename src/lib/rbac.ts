import { WorkspaceRole } from "@prisma/client";

export const rolePriority: Record<WorkspaceRole, number> = {
  ANALYST: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function hasRequiredRole(userRole: WorkspaceRole, requiredRole: WorkspaceRole) {
  return rolePriority[userRole] >= rolePriority[requiredRole];
}

