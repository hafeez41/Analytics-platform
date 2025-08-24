import { pgTable, serial, varchar, text, timestamp, jsonb, integer, decimal, boolean, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - handles authentication
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatar: text('avatar'),
  emailVerified: timestamp('email_verified'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Organizations table - multi-tenancy (each customer is an org)
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(), // mycompany.analytics.com
  plan: varchar('plan', { length: 50 }).default('free').notNull(), // free, pro, enterprise
  billingEmail: varchar('billing_email', { length: 255 }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: index('org_slug_idx').on(table.slug),
}));

// User-Organization relationships with roles
export const userOrganizations = pgTable('user_organizations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('member'), // owner, admin, member
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userOrgIdx: index('user_org_idx').on(table.userId, table.organizationId),
  uniqUserOrg: unique('uniq_user_org').on(table.userId, table.organizationId),
}));

// Projects - each org can track multiple apps/websites
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  apiKey: varchar('api_key', { length: 64 }).notNull().unique(), // for sending events
  domain: varchar('domain', { length: 255 }), // optional - website domain
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('project_org_idx').on(table.organizationId),
  apiKeyIdx: index('project_api_key_idx').on(table.apiKey),
}));

// Events - raw analytics data coming from customer websites/apps
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  eventName: varchar('event_name', { length: 255 }).notNull(), // "page_view", "button_click", "purchase"
  userId: varchar('user_id', { length: 255 }), // customer's user ID (optional)
  sessionId: varchar('session_id', { length: 255 }), // customer's session ID (optional)
  metadata: jsonb('metadata'), // flexible JSON data: { "page": "/pricing", "amount": 29.99 }
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('event_org_idx').on(table.organizationId),
  projectIdx: index('event_project_idx').on(table.projectId),
  timestampIdx: index('event_timestamp_idx').on(table.timestamp),
  eventNameIdx: index('event_name_idx').on(table.eventName),
  // Composite index for fast queries
  orgProjectTimeIdx: index('event_org_project_time_idx').on(table.organizationId, table.projectId, table.timestamp),
}));

// KPI Snapshots - pre-calculated analytics for fast dashboard loading
export const kpiSnapshots = pgTable('kpi_snapshots', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }), // null = org-level KPI
  key: varchar('key', { length: 100 }).notNull(), // "daily_page_views", "monthly_revenue", "bounce_rate"
  periodStart: timestamp('period_start').notNull(), // start of time period
  periodEnd: timestamp('period_end').notNull(), // end of time period
  value: decimal('value', { precision: 15, scale: 4 }).notNull(), // the calculated metric
  metadata: jsonb('metadata'), // additional context: { "breakdown": { "mobile": 1200, "desktop": 800 } }
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('kpi_org_idx').on(table.organizationId),
  projectIdx: index('kpi_project_idx').on(table.projectId),
  keyIdx: index('kpi_key_idx').on(table.key),
  periodIdx: index('kpi_period_idx').on(table.periodStart, table.periodEnd),
  // Unique constraint to prevent duplicate snapshots
  uniqOrgProjectKeyPeriod: unique('uniq_org_project_key_period').on(
    table.organizationId, 
    table.projectId, 
    table.key, 
    table.periodStart
  ),
}));

// Relations for Drizzle ORM (makes joins easier)
export const usersRelations = relations(users, ({ many }) => ({
  organizations: many(userOrganizations),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(userOrganizations),
  projects: many(projects),
  events: many(events),
  kpiSnapshots: many(kpiSnapshots),
}));

export const userOrganizationsRelations = relations(userOrganizations, ({ one }) => ({
  user: one(users, {
    fields: [userOrganizations.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [userOrganizations.organizationId],
    references: [organizations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  events: many(events),
  kpiSnapshots: many(kpiSnapshots),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  organization: one(organizations, {
    fields: [events.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [events.projectId],
    references: [projects.id],
  }),
}));

export const kpiSnapshotsRelations = relations(kpiSnapshots, ({ one }) => ({
  organization: one(organizations, {
    fields: [kpiSnapshots.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [kpiSnapshots.projectId],
    references: [projects.id],
  }),
}));