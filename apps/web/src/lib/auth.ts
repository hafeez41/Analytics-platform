import NextAuth, { NextAuthOptions } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import EmailProvider from "next-auth/providers/email";
import { db, users, organizations, userOrganizations } from "@analytics-platform/db";
import { eq } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  // Use Drizzle adapter to connect NextAuth to our database
  adapter: DrizzleAdapter(db),

  // Authentication providers
  providers: [
    // Magic link email authentication
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST!,
        port: Number(process.env.SMTP_PORT!),
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
      },
      from: process.env.EMAIL_FROM || "noreply@yourapp.com",
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // GitHub OAuth
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],

  // Custom pages
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
    error: "/auth/error",
  },

  // Session configuration
  session: {
    strategy: "jwt",
  },

  // Callbacks to customize authentication flow
  callbacks: {
    // Add user's organizations and active org to session
    async session({ session, token }) {
      if (session.user?.email && token.sub) {
        // Get user's organizations and roles
        const userOrgs = await db
          .select({
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            role: userOrganizations.role,
          })
          .from(userOrganizations)
          .innerJoin(organizations, eq(organizations.id, userOrganizations.organizationId))
          .innerJoin(users, eq(users.id, userOrganizations.userId))
          .where(eq(users.email, session.user.email));

        // Add to session
        session.user.id = token.sub as string;
        session.user.organizations = userOrgs;
        
        // Set active org (first one by default, can be changed later)
        session.user.activeOrgId = userOrgs[0]?.id || null;
        session.user.activeOrgRole = userOrgs[0]?.role || null;
      }

      return session;
    },

    // Add user ID to JWT token
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },

  // Event handlers
  events: {
    async createUser({ user }) {
      // When a new user is created, give them a personal organization
      if (user.email && user.id) {
        try {
          // Create personal organization
          const [newOrg] = await db
            .insert(organizations)
            .values({
              name: `${user.name || user.email.split('@')[0]}'s Organization`,
              slug: `${user.email.split('@')[0]}-${Date.now()}`.toLowerCase(),
              plan: 'free',
              billingEmail: user.email,
            })
            .returning();

          // Make user the owner of their personal organization
          await db.insert(userOrganizations).values({
            userId: parseInt(user.id),
            organizationId: newOrg.id,
            role: 'owner',
          });

        } catch (error) {
          console.error('Error creating personal organization:', error);
        }
      }
    },
  },
};

// Create and export the NextAuth handler
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

// Type extensions for NextAuth session
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      organizations: Array<{
        id: number;
        name: string;
        slug: string;
        role: string;
      }>;
      activeOrgId: number | null;
      activeOrgRole: string | null;
    };
  }
}