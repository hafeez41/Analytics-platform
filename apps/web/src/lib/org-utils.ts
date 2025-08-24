import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { headers } from 'next/headers';

/**
 * Organization utility functions
 * Helpers for extracting and validating organization context
 */

/**
 * Get the current user's active organization from session
 * Returns null if no active org or not authenticated
 */
export async function getCurrentOrgId(): Promise<number | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.activeOrgId || null;
}

/**
 * Get organization ID from request context
 * Checks multiple sources: headers, query params, etc.
 */
export async function getOrgIdFromRequest(): Promise<number | null> {
  // In server components, we can access headers
  try {
    const headersList = await headers();
    const orgIdHeader = headersList.get('x-org-id');
    if (orgIdHeader) {
      return parseInt(orgIdHeader, 10);
    }
  } catch {
    // Headers might not be available in all contexts
  }

  return null;
}

/**
 * Validate organization ID is a positive integer
 */
export function isValidOrgId(orgId: unknown): orgId is number {
  return typeof orgId === 'number' && orgId > 0 && Number.isInteger(orgId);
}

/**
 * Parse organization ID from string (URL params, form data, etc.)
 */
export function parseOrgId(value: string | null | undefined): number | null {
  if (!value) return null;
  
  const parsed = parseInt(value, 10);
  return isValidOrgId(parsed) ? parsed : null;
}

/**
 * Get user's organization membership info
 * Returns role and organization details for current user
 */
export async function getUserOrgMembership(orgId: number) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.organizations) {
    return null;
  }

  return session.user.organizations.find(org => org.id === orgId) || null;
}

/**
 * Check if user has minimum role in organization
 * Returns boolean without throwing errors
 */
export async function hasOrgAccess(orgId: number, minRole: 'member' | 'admin' | 'owner' = 'member'): Promise<boolean> {
  try {
    const membership = await getUserOrgMembership(orgId);
    if (!membership) return false;

    const roleHierarchy = { member: 1, admin: 2, owner: 3 };
    const userRoleLevel = roleHierarchy[membership.role as keyof typeof roleHierarchy] || 0;
    const minRoleLevel = roleHierarchy[minRole];

    return userRoleLevel >= minRoleLevel;
  } catch {
    return false;
  }
}

/**
 * Create organization-aware error messages
 */
export function createOrgError(type: 'not_found' | 'access_denied' | 'invalid_id', orgId?: number) {
  const messages = {
    not_found: `Organization${orgId ? ` ${orgId}` : ''} not found`,
    access_denied: `Access denied to organization${orgId ? ` ${orgId}` : ''}`,
    invalid_id: 'Invalid organization ID',
  };

  return new Error(messages[type]);
}

/**
 * Format organization display name
 * Handles edge cases for display purposes
 */
export function formatOrgName(org: { name?: string; slug?: string; id: number }): string {
  if (org.name) return org.name;
  if (org.slug) return org.slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return `Organization ${org.id}`;
}

/**
 * Generate organization-specific URLs
 */
export function getOrgUrl(orgId: number, path: string = ''): string {
  const basePath = `/org/${orgId}`;
  return path ? `${basePath}${path.startsWith('/') ? '' : '/'}${path}` : basePath;
}

/**
 * Type guard for organization context
 */
export interface OrgContext {
  orgId: number;
  userId: string;
  role: string;
}

/**
 * Create organization context from session
 * Used in pages and components that need org context
 */
export async function createOrgContext(orgId: number): Promise<OrgContext | null> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }

  const membership = await getUserOrgMembership(orgId);
  
  if (!membership) {
    return null;
  }

  return {
    orgId,
    userId: session.user.id,
    role: membership.role,
  };
}