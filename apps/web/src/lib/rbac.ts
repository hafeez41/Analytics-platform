import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { db, userOrganizations, organizations } from "@analytics-platform/db";
import { eq, and } from "drizzle-orm";

// Define role hierarchy
export const ROLES = {
  owner: 3,
  admin: 2, 
  member: 1,
} as const;

export type Role = keyof typeof ROLES;

// Check if user has minimum role in organization
export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLES[userRole] >= ROLES[requiredRole];
}

// Assert user has required role or throw error
export async function assertRole(orgId: number, requiredRoles: Role[]) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    throw new Error('Unauthorized: No session found');
  }

  // Get user's role in the organization
  const userOrg = await db
    .select({ role: userOrganizations.role })
    .from(userOrganizations)
    .innerJoin(organizations, eq(organizations.id, userOrganizations.organizationId))
    .where(
      and(
        eq(userOrganizations.organizationId, orgId),
        eq(userOrganizations.userId, parseInt(session.user.id))
      )
    )
    .limit(1);

  if (userOrg.length === 0) {
    throw new Error('Forbidden: User not a member of this organization');
  }

  const userRole = userOrg[0].role as Role;
  const hasPermission = requiredRoles.some(role => hasMinimumRole(userRole, role));

  if (!hasPermission) {
    throw new Error(`Forbidden: Requires one of these roles: ${requiredRoles.join(', ')}`);
  }

  return { userRole, orgId };
}

// Get user's organizations with roles (for client components)
export async function getUserOrganizations() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return [];
  }

  return await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      plan: organizations.plan,
      role: userOrganizations.role,
    })
    .from(userOrganizations)
    .innerJoin(organizations, eq(organizations.id, userOrganizations.organizationId))
    .where(eq(userOrganizations.userId, parseInt(session.user.id)));
}

// Check if user can access organization data
export async function canAccessOrg(orgId: number): Promise<boolean> {
  try {
    await assertRole(orgId, ['member']); // Member is minimum access
    return true;
  } catch {
    return false;
  }
}

// Wrapper for database queries to ensure org-level data isolation
export function dbForOrg(orgId: number) {
  return {
    // This will be expanded in Step 4 (multi-tenancy)
    async withOrgAccess<T>(operation: () => Promise<T>): Promise<T> {
      await assertRole(orgId, ['member']);
      return operation();
    }
  };
}