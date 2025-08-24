import dotenv from 'dotenv';
import pino from 'pino';

// Load environment variables (API keys, database URLs, etc.)
dotenv.config();

// Set up logging so we can see what the worker is doing
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function main() {
  logger.info('🚀 Analytics Worker starting...');
  
  // TODO: In the next steps, we'll set up:
  // - BullMQ workers to process data
  // - Database connections  
  // - Job handlers for analytics calculations
  
  logger.info('✅ Worker ready and listening for jobs');
  
  // Keep the process running
  process.on('SIGINT', () => {
    logger.info('👋 Worker shutting down gracefully...');
    process.exit(0);
  });
}

// Start the worker
main().catch((error) => {
  console.error('❌ Failed to start worker:', error);
  process.exit(1);
});