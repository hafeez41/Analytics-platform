// Centralized configuration for all apps
// Both web app and worker app will import these settings

export const config = {
  // Database connection settings
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/analytics',
  },
  
  // Redis (for job queue and caching)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // Authentication settings
  auth: {
    nextAuthSecret: process.env.NEXTAUTH_SECRET || 'your-secret-key-here',
    nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  },
  
  // Payment processing
  stripe: {
    publicKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    secretKey: process.env.STRIPE_SECRET_KEY || '',
  },
} as const;