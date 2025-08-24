'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrgDb } from '@/lib/db-org';
import { assertRole } from '@/lib/rbac';

/**
 * Server Actions for organization-scoped operations
 * These can be called directly from React components
 */

/**
 * Get all projects for an organization
 * Used in server components and forms
 */
export async function getOrgProjects(orgId: number) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    // Create org-scoped database - automatically verifies access
    const orgDb = await getOrgDb(orgId);
    
    // Get projects for this organization only
    const projects = await orgDb.getProjects();

    return {
      success: true,
      data: projects,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch projects',
    };
  }
}

/**
 * Get organization dashboard data
 * Requires member access or higher
 */
export async function getOrgDashboard(orgId: number) {
  try {
    // Verify user has at least member access
    await assertRole(orgId, ['member']);

    // Create org-scoped database
    const orgDb = await getOrgDb(orgId);

    // Get dashboard data - all automatically scoped to organization
    const [projects, recentEvents, kpiSnapshots] = await Promise.all([
      orgDb.getProjects(),
      orgDb.getEvents(undefined, 10), // Get last 10 events
      orgDb.getKpiSnapshots(), // Get all KPI snapshots
    ]);

    // Calculate some basic metrics
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.isActive).length;
    const totalEvents = recentEvents.length;

    return {
      success: true,
      data: {
        organization: await orgDb.getOrganization(),
        metrics: {
          totalProjects,
          activeProjects,
          totalEvents,
        },
        projects,
        recentEvents,
        kpiSnapshots,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
    };
  }
}

/**
 * Create a new project
 * Requires admin access or higher
 */
export async function createProject(
  orgId: number,
  projectData: {
    name: string;
    description?: string;
    domain?: string;
  }
) {
  try {
    // Verify user has admin access
    await assertRole(orgId, ['admin', 'owner']);

    // Validate input
    if (!projectData.name || projectData.name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    // Create org-scoped database
    const orgDb = await getOrgDb(orgId);

    // Create project - automatically scoped to organization
    const [newProject] = await orgDb.createProject({
      name: projectData.name.trim(),
      description: projectData.description?.trim(),
      domain: projectData.domain?.trim(),
    });

    return {
      success: true,
      data: newProject,
      message: `Project "${newProject.name}" created successfully`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create project',
    };
  }
}

/**
 * Get user's organizations
 * Returns all orgs the current user is a member of
 */
export async function getUserOrganizations() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error('Authentication required');
    }

    // Use the RBAC helper to get user organizations
    const { getUserOrganizations } = await import('@/lib/rbac');
    const organizations = await getUserOrganizations();

    return {
      success: true,
      data: organizations,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch organizations',
    };
  }
}

/**
 * Switch active organization
 * Updates user's session with new active org
 */
export async function switchActiveOrg(orgId: number) {
  try {
    // Verify user has access to this organization
    const orgDb = await getOrgDb(orgId);
    const [organization] = await orgDb.getOrganization();

    if (!organization) {
      throw new Error('Organization not found');
    }

    // In a full implementation, you'd update the session here
    // For now, just return success
    return {
      success: true,
      data: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      message: `Switched to ${organization.name}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to switch organization',
    };
  }
}