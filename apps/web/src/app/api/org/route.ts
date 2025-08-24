import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, userOrganizations, organizations } from '@analytics-platform/db';
import { eq, and } from 'drizzle-orm';

/**
 * API route to switch user's active organization
 * POST /api/org/route.ts (becomes /api/org)
 * Body: { orgId: number }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { orgId } = body;

    if (!orgId || typeof orgId !== 'number') {
      return NextResponse.json(
        { error: 'Invalid organization ID' },
        { status: 400 }
      );
    }

    // Verify user has access to this organization
    const membership = await db
      .select({
        role: userOrganizations.role,
        orgId: organizations.id,
        orgName: organizations.name,
        orgSlug: organizations.slug,
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(organizations.id, userOrganizations.organizationId))
      .where(
        and(
          eq(userOrganizations.userId, parseInt(session.user.id)),
          eq(userOrganizations.organizationId, orgId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        { error: 'Access denied to organization' },
        { status: 403 }
      );
    }

    const org = membership[0];

    // Return success with organization details
    // Note: In a full implementation, you'd update the session here
    return NextResponse.json({
      success: true,
      activeOrg: {
        id: org.orgId,
        name: org.orgName,
        slug: org.orgSlug,
        role: org.role,
      },
      message: `Switched to ${org.orgName}`,
    });

  } catch (error) {
    console.error('Error switching organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}