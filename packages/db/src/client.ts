import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../.env.local' });

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

// Create PostgreSQL connection
const queryClient = postgres(databaseUrl);

// Create Drizzle database instance with schema
export const db = drizzle(queryClient, { schema });

// Export the connection for manual queries if needed
export { queryClient };

// Type helper for the database
export type Database = typeof db;