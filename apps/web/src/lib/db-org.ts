import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { db, projects, events, kpiSnapshots, userOrganizations, organizations } from "@analytics-platform/db";
import { eq, and } from "drizzle-orm";

/**
 * Organization-aware database wrapper
 * Ensures all queries are automatically filtered by organization ID
 * Prevents accidental cross-organization data access
 */
export class OrgDatabase {
  private orgId: number;
  private userId: string;

  constructor(orgId: number, userId: string) {
    this.orgId = orgId;
    this.userId = userId;
  }

  /**
   * Create an org-scoped database instance
   * Verifies user has access to the organization
   */
  static async create(orgId: number): Promise<OrgDatabase> {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      throw new Error('Unauthorized: No valid session');
    }

    // Verify user has access to this organization
    const membership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.organizationId, orgId),
          eq(userOrganizations.userId, parseInt(session.user.id))
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw new Error('Forbidden: User not a member of this organization');
    }

    return new OrgDatabase(orgId, session.user.id);
  }

  /**
   * Get projects for this organization only
   */
  async getProjects() {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, this.orgId));
  }

  /**
   * Get a specific project (org-scoped)
   */
  async getProject(projectId: number) {
    const result = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.organizationId, this.orgId)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get events for this organization (with optional project filter)
   */
  async getEvents(projectId?: number, limit: number = 1000) {
    const conditions = [eq(events.organizationId, this.orgId)];
    
    if (projectId) {
      conditions.push(eq(events.projectId, projectId));
    }

    return await db
      .select()
      .from(events)
      .where(and(...conditions))
      .limit(limit)
      .orderBy(events.timestamp);
  }

  /**
   * Get KPI snapshots for this organization
   */
  async getKpiSnapshots(projectId?: number, key?: string) {
    const conditions = [eq(kpiSnapshots.organizationId, this.orgId)];
    
    if (projectId) {
      conditions.push(eq(kpiSnapshots.projectId, projectId));
    }
    
    if (key) {
      conditions.push(eq(kpiSnapshots.key, key));
    }

    return await db
      .select()
      .from(kpiSnapshots)
      .where(and(...conditions))
      .orderBy(kpiSnapshots.periodStart);
  }

  /**
   * Create a new project for this organization
   */
  async createProject(data: {
    name: string;
    description?: string;
    domain?: string;
  }) {
    // Generate API key for the project
    const apiKey = generateApiKey();

    return await db
      .insert(projects)
      .values({
        organizationId: this.orgId,
        name: data.name,
        description: data.description,
        domain: data.domain,
        apiKey,
        isActive: true,
      })
      .returning();
  }

  /**
   * Insert event (automatically scoped to organization)
   */
  async insertEvent(projectId: number, eventData: {
    eventName: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Verify project belongs to this organization
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    return await db
      .insert(events)
      .values({
        organizationId: this.orgId,
        projectId,
        ...eventData,
      })
      .returning();
  }

  /**
   * Get organization info (user must be a member)
   */
  async getOrganization() {
    return await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, this.orgId))
      .limit(1);
  }

  /**
   * Get the organization ID this database instance is scoped to
   */
  getOrgId(): number {
    return this.orgId;
  }

  /**
   * Get the user ID this database instance is scoped to
   */
  getUserId(): string {
    return this.userId;
  }
}

/**
 * Generate a secure API key for project data ingestion
 */
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Convenience function to create org database from request headers
 */
export async function getOrgDb(orgId: number): Promise<OrgDatabase> {
  return await OrgDatabase.create(orgId);
}