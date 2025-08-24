import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrgDb } from '@/lib/db-org';

/**
 * API route to get projects for a specific organization
 * GET /api/projects?orgId=123
 * 
 * Demonstrates org-scoped database access pattern
 */
export async function GET(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get organization ID from query params
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Create org-scoped database instance
    // This automatically verifies user has access to the organization
    const orgDb = await getOrgDb(parseInt(orgId, 10));

    // Get projects for this organization only
    // The orgDb wrapper ensures we can't accidentally access other orgs' data
    const projects = await orgDb.getProjects();

    return NextResponse.json({
      success: true,
      orgId: orgDb.getOrgId(),
      projects,
      count: projects.length,
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    
    // Handle different error types
    if (error instanceof Error) {
      if (error.message.includes('Forbidden') || error.message.includes('not a member')) {
        return NextResponse.json(
          { error: 'Access denied to organization' },
          { status: 403 }
        );
      }
      
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * API route to create a new project for an organization
 * POST /api/projects?orgId=123
 * Body: { name: string, description?: string, domain?: string }
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

    // Get organization ID from query params
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { name, description, domain } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Create org-scoped database instance
    const orgDb = await getOrgDb(parseInt(orgId, 10));

    // Create project - automatically scoped to this organization
    const [newProject] = await orgDb.createProject({
      name,
      description,
      domain,
    });

    return NextResponse.json({
      success: true,
      message: 'Project created successfully',
      project: newProject,
    });

  } catch (error) {
    console.error('Error creating project:', error);
    
    // Handle different error types
    if (error instanceof Error) {
      if (error.message.includes('Forbidden') || error.message.includes('not a member')) {
        return NextResponse.json(
          { error: 'Access denied to organization' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}