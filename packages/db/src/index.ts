// Main exports for the database package
// Both web app and worker app import from here

// Export all database tables and relations
export * from './schema';

// Export database client and types
export { db, queryClient, type Database } from './client';