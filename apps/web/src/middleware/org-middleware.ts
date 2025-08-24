import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

interface ExtendedJWT {
  organizations?: Array<{ id: number }>;
}

/**
 * Middleware to ensure organization-level data isolation
 * Runs on API routes to verify user has access to requested organization
 */
export async function orgMiddleware(req: NextRequest) {
  // Get the JWT token from the request
  const token = await getToken({ 
    req, 
    secret: process.env.NEXTAUTH_SECRET 
  });

  // If no session, let NextAuth handle it
  if (!token) {
    return NextResponse.next();
  }

  // Extract orgId from request (could be in query, header, or body)
  const orgId = getOrgIdFromRequest(req);

  // If no orgId in request, continue (some routes don't need org context)
  if (!orgId) {
    return NextResponse.next();
  }

  // Verify user has access to this organization
  const hasAccess = await verifyOrgAccess(token as ExtendedJWT, orgId);

  if (!hasAccess) {
    return new NextResponse(
      JSON.stringify({ error: 'Forbidden: No access to this organization' }),
      { 
        status: 403, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  // Add orgId to request headers for downstream use
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-org-id', orgId.toString());

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Extract organization ID from various parts of the request
 */
function getOrgIdFromRequest(req: NextRequest): number | null {
  // Check URL search params (?orgId=123)
  const urlOrgId = req.nextUrl.searchParams.get('orgId');
  if (urlOrgId) return parseInt(urlOrgId, 10);

  // Check headers (X-Org-ID: 123)
  const headerOrgId = req.headers.get('x-org-id');
  if (headerOrgId) return parseInt(headerOrgId, 10);

  // Check URL path segments (/api/org/123/...)
  const pathMatch = req.nextUrl.pathname.match(/\/api\/org\/(\d+)/);
  if (pathMatch) return parseInt(pathMatch[1], 10);

  return null;
}

/**
 * Verify user has membership in the requested organization
 * This is a simplified version - we'll enhance it with database checks
 */
async function verifyOrgAccess(token: ExtendedJWT, orgId: number): Promise<boolean> {
  // For now, check if orgId is in the user's session organizations
  // In a full implementation, we'd query the database
  const userOrganizations = token.organizations || [];
  
  return userOrganizations.some((org: { id: number }) => org.id === orgId);
}

/**
 * Helper to get organization ID from request in API routes
 */
export function getOrgIdFromHeaders(req: Request): number | null {
  const orgId = req.headers.get('x-org-id');
  return orgId ? parseInt(orgId, 10) : null;
}