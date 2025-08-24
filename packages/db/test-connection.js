// Quick test to verify database connection works
require('dotenv').config({ path: '../../.env.local' });
const postgres = require('postgres');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

async function testConnection() {
  const sql = postgres(databaseUrl);
  
  try {
    // Test basic connection
    const result = await sql`SELECT 1 as test`;
    console.log('✅ Database connection successful!');
    
    // Test our tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('📋 Tables found:', tables.map(t => t.table_name));
    
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();